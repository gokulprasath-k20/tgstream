'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }    from 'next/navigation';
import io               from 'socket.io-client';
import dynamic          from 'next/dynamic';

// ── Layout components ──────────────────────────────────────────────────────────
import BottomNav              from '@/components/BottomNav';
import MobileChatList         from '@/components/MobileChatList';
import MobileContactsScreen   from '@/components/MobileContactsScreen';
import MobileRequestsScreen   from '@/components/MobileRequestsScreen';

// ── Lazily loaded (reduce initial bundle) ──────────────────────────────────────
const ChatWindow         = dynamic(() => import('@/components/ChatWindow'),         { ssr: false });
const MobileProfileScreen = dynamic(() => import('@/components/MobileProfileScreen'), { ssr: false });
const NotificationManager = dynamic(() => import('@/components/NotificationManager'), { ssr: false });
const VoiceCallModal      = dynamic(() => import('@/components/VoiceCallModal'),      { ssr: false });
const TgIdSearchPanel     = dynamic(() => import('@/components/TgIdSearchPanel'),     { ssr: false });

// ── E2EE bootstrap ─────────────────────────────────────────────────────────────
async function bootstrapE2EE(userId) {
  if (typeof window === 'undefined') return;
  try {
    const { getOrGenerateKeyPair, exportPublicKey } = await import('@/lib/crypto');
    const keyPair = await getOrGenerateKeyPair(userId);
    const pubB64  = await exportPublicKey(keyPair.publicKey);
    const existing = await fetch('/api/keys').then(r => r.json());
    if (existing.publicKey !== pubB64) {
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: pubB64 }),
      });
    }
  } catch (err) {
    console.warn('[E2EE] bootstrap failed (non-fatal):', err.message);
  }
}

// ── TG ID migration for old users ──────────────────────────────────────────────
async function ensureTgId(user, setUser) {
  if (user?.tgId) return;
  try {
    const res  = await fetch('/api/user/migrate-tgid', { method: 'POST' });
    const data = await res.json();
    if (data.tgId) setUser(u => ({ ...u, tgId: data.tgId }));
  } catch {}
}

// ── Loading screen ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="h-mobile-screen bg-[#05060f] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-3xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/20">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
      <p className="text-gray-600 text-sm">Loading TGStream…</p>
    </div>
  );
}

// ── Mobile top header ──────────────────────────────────────────────────────────
function MobileHeader({ tab, activeConversation, onBack, onOpenSearch, user }) {
  // Chat screen header with back button
  if (activeConversation) {
    const other = activeConversation.participants?.find(p => p._id !== user?.id);
    const COLORS = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600','bg-cyan-600'];
    const avatarBg = COLORS[(other?.username?.charCodeAt(0) || 0) % COLORS.length];
    return (
      <div
        className="flex-shrink-0 flex items-center gap-3 px-3 h-14 bg-[#0a0b15] border-b border-white/8"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <button
          id="chat-back-btn"
          onClick={onBack}
          className="w-9 h-9 rounded-xl hover:bg-white/8 text-gray-400 hover:text-white flex items-center justify-center transition-colors active:scale-90 flex-shrink-0"
          aria-label="Back"
        >
          {/* Back chevron */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center font-bold text-white text-sm flex-shrink-0`}>
          {other?.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate leading-tight">{other?.username || 'Unknown'}</p>
          {other?.tgId && (
            <p className="text-indigo-400/60 text-[10px] font-mono truncate">@{other.tgId}</p>
          )}
        </div>
      </div>
    );
  }

  // Tab headers
  const TITLES = {
    chats:    'Messages',
    requests: 'Requests',
    contacts: 'Contacts',
    profile:  'Profile',
  };

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 h-14 bg-[#0a0b15] border-b border-white/8"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <h1 className="font-bold text-white text-lg">{TITLES[tab] || 'TGStream'}</h1>
      {tab === 'chats' && (
        <button
          id="open-tgid-search-btn"
          onClick={onOpenSearch}
          title="Find by TG ID"
          className="w-9 h-9 rounded-xl hover:bg-white/8 text-gray-400 hover:text-indigo-400 flex items-center justify-center transition-colors active:scale-90"
        >
          {/* Hash icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Chat Page
// ══════════════════════════════════════════════════════════════════════════════
export default function ChatPage() {
  const router = useRouter();

  // ── Auth & data ─────────────────────────────────────────────────────────────
  const [user,              setUser]              = useState(null);
  const [socket,            setSocket]            = useState(null);
  const [conversations,     setConversations]     = useState([]);
  const [activeConversation, setActive]           = useState(null);
  const [onlineUsers,       setOnlineUsers]       = useState(new Set());
  const [typingMap,         setTypingMap]         = useState({});
  const [unreadCounts,      setUnreadCounts]      = useState({});
  const [requestCount,      setRequestCount]      = useState(0);
  const [convLoading,       setConvLoading]       = useState(true);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab,   setActiveTab]   = useState('chats');   // 'chats'|'requests'|'contacts'|'profile'
  const [showSearch,  setShowSearch]  = useState(false);     // TG ID search overlay

  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeConversation?._id; }, [activeConversation]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(async (data) => {
        if (!data.user) { router.push('/login'); return; }
        setUser(data.user);
        ensureTgId(data.user, setUser);
        bootstrapE2EE(data.user.id);

        // Load conversations + request count in parallel
        const [convRes, reqRes] = await Promise.all([
          fetch('/api/conversations').then(r => r.json()),
          fetch('/api/contact/requests').then(r => r.json()),
        ]);
        setConversations(convRes.conversations || []);
        setRequestCount(reqRes.count || 0);
        setConvLoading(false);

        // Connect socket
        const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const s   = io(url, { transports: ['websocket'] });
        setSocket(s);

        s.on('connect', () => {
          s.emit('join-user-room', { userId: data.user.id, username: data.user.username });
        });

        // Presence
        s.on('online-users', ids => setOnlineUsers(new Set(ids)));
        s.on('user-online',  ({ userId }) => setOnlineUsers(p => new Set([...p, userId])));
        s.on('user-offline', ({ userId }) => setOnlineUsers(p => { const n = new Set(p); n.delete(userId); return n; }));

        // Incoming DMs
        s.on('receive-dm', ({ conversationId, message }) => {
          setConversations(prev => {
            const updated = prev.map(c =>
              c._id === conversationId
                ? { ...c, updatedAt: message.createdAt, lastMessage: { text: message.text || '', senderName: message.senderName, createdAt: message.createdAt } }
                : c
            );
            return [...updated].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          });
          if (conversationId !== activeIdRef.current) {
            setUnreadCounts(p => ({ ...p, [conversationId]: (p[conversationId] || 0) + 1 }));
          }
        });

        // Typing
        s.on('typing-start', ({ conversationId }) =>
          setTypingMap(p => ({ ...p, [conversationId]: true }))
        );
        s.on('typing-stop', ({ conversationId }) =>
          setTypingMap(p => { const n = { ...p }; delete n[conversationId]; return n; })
        );

        // Contact events
        s.on('new-contact-request',     ()  => setRequestCount(c => c + 1));
        s.on('contact-request-accepted', () => {
          fetch('/api/conversations').then(r => r.json()).then(d =>
            setConversations(d.conversations || [])
          );
        });

        return () => s.close();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  // ── Push Notifications (Capacitor FCM) ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const setupPush = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') return;

        await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
          fetch('/api/users/fcm-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value }),
          }).catch(console.warn);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Push received: ', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('[FCM] Action performed: ', notification);
          // Optional: handle deep linking or navigating to specific chat here
        });
      } catch (err) {
        console.warn('[FCM] Push setup failed (ignoring if not on native device):', err);
      }
    };
    setupPush();
  }, [user]);

  // ── Android back button (Capacitor) ─────────────────────────────────────────
  useEffect(() => {
    const handleBackButton = ({ detail }) => {
      if (showSearch) { setShowSearch(false); return; }
      if (activeConversation) { setActive(null); return; }
      if (activeTab !== 'chats') { setActiveTab('chats'); return; }
      // Minimize app on root screen (App.exitApp())
      detail?.register?.(9999, done => { done(); });
    };
    document.addEventListener('ionBackButton', handleBackButton);
    return () => document.removeEventListener('ionBackButton', handleBackButton);
  }, [showSearch, activeConversation, activeTab]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectConversation = useCallback((conv) => {
    setActive(conv);
    setUnreadCounts(p => ({ ...p, [conv._id]: 0 }));
    setActiveTab('chats');
  }, []);

  const handleStartDM = useCallback(async (recipientId) => {
    const res  = await fetch('/api/conversations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ recipientId }),
    });
    const data = await res.json();
    if (data.conversation) {
      if (data.isRequest) {
        socket?.emit('send-contact-request', {
          recipientId,
          senderName:     user?.username,
          conversationId: data.conversation._id,
        });
      }
      setConversations(prev => {
        const exists = prev.find(c => c._id === data.conversation._id);
        return exists ? prev : [data.conversation, ...prev];
      });
      handleSelectConversation(data.conversation);
    }
  }, [socket, user, handleSelectConversation]);

  const handleRequestAccepted = useCallback((conv) => {
    setConversations(prev => {
      const exists = prev.find(c => c._id === conv._id);
      return exists
        ? prev.map(c => c._id === conv._id ? conv : c)
        : [conv, ...prev];
    });
    setRequestCount(c => Math.max(0, c - 1));
    handleSelectConversation(conv);
  }, [handleSelectConversation]);

  const handleConversationUpdate = useCallback((updated) => {
    setConversations(prev => {
      const list = prev.map(c => c._id === updated._id ? updated : c);
      return [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  }, []);

  const handleNavToConversation = useCallback((conversationId) => {
    const conv = conversations.find(c => c._id === conversationId);
    if (conv) handleSelectConversation(conv);
  }, [conversations, handleSelectConversation]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // ── Render ───────────────────────────────────────────────────────────────────
  if (!user) return <LoadingScreen />;

  return (
    <>
      {/* Global overlays */}
      <VoiceCallModal socket={socket} user={user} />
      <NotificationManager
        socket={socket}
        activeConversationId={activeConversation?._id}
        onNavigate={handleNavToConversation}
      />

      {/* ── TG ID Search overlay (full-screen modal) ── */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-[#05060f] animate-slide-in-right">
          <TgIdSearchPanel
            onAddContact={(conv) => {
              if (conv) handleSelectConversation(conv);
              setShowSearch(false);
            }}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}

      {/* ── App shell ── */}
      <div className="h-mobile-screen flex flex-col bg-[#05060f] text-white overflow-hidden">

        {/* Top header — context-aware */}
        <MobileHeader
          tab={activeTab}
          activeConversation={activeConversation}
          onBack={() => setActive(null)}
          onOpenSearch={() => setShowSearch(true)}
          user={user}
        />

        {/* Content area */}
        <div className="flex-1 min-h-0 relative">

          {/* ── CHATS TAB ── */}
          {activeTab === 'chats' && !activeConversation && (
            <MobileChatList
              user={user}
              conversations={conversations}
              onlineUsers={onlineUsers}
              typingMap={typingMap}
              unreadCounts={unreadCounts}
              onSelectConversation={handleSelectConversation}
              onOpenSearch={() => setShowSearch(true)}
              loading={convLoading}
            />
          )}

          {/* ── CHAT WINDOW (slides in when conversation selected) ── */}
          {activeTab === 'chats' && activeConversation && (
            <ChatWindow
              key={activeConversation._id}
              conversation={activeConversation}
              user={user}
              socket={socket}
              onlineUsers={onlineUsers}
              typing={typingMap[activeConversation._id]}
              onConversationUpdate={handleConversationUpdate}
              mobileMode
            />
          )}

          {/* ── REQUESTS TAB ── */}
          {activeTab === 'requests' && (
            <MobileRequestsScreen
              user={user}
              socket={socket}
              onAccepted={handleRequestAccepted}
              onRequestCountChange={setRequestCount}
            />
          )}

          {/* ── CONTACTS TAB ── */}
          {activeTab === 'contacts' && (
            <MobileContactsScreen
              user={user}
              onlineUsers={onlineUsers}
              onStartDM={(id) => {
                handleStartDM(id);
                setActiveTab('chats');
              }}
              onOpenSearch={() => setShowSearch(true)}
            />
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <MobileProfileScreen user={user} />
          )}
        </div>

        {/* Bottom nav — hidden when inside chat window */}
        {!activeConversation && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={tab => { setActiveTab(tab); }}
            requestCount={requestCount}
            unreadTotal={totalUnread}
          />
        )}
      </div>
    </>
  );
}
