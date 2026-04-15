'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';
import dynamic from 'next/dynamic';
import ChatSidebar  from '@/components/ChatSidebar';
import ChatWindow   from '@/components/ChatWindow';

const NotificationManager = dynamic(() => import('@/components/NotificationManager'), { ssr: false });
const VoiceCallModal      = dynamic(() => import('@/components/VoiceCallModal'),      { ssr: false });

// ── E2EE key bootstrap ────────────────────────────────────────────────────────
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

// ── TG ID migration (existing users who pre-date the tgId feature) ────────────
async function ensureTgId(user, setUser) {
  if (user?.tgId) return;     // already has one
  try {
    const res  = await fetch('/api/user/migrate-tgid', { method: 'POST' });
    const data = await res.json();
    if (data.tgId) {
      setUser(u => ({ ...u, tgId: data.tgId }));
    }
  } catch {}
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser]                   = useState(null);
  const [socket, setSocket]               = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActive]   = useState(null);
  const [onlineUsers, setOnlineUsers]     = useState(new Set());
  const [typingMap, setTypingMap]         = useState({});
  const [unreadCounts, setUnreadCounts]   = useState({});
  const [requestCount, setRequestCount]   = useState(0);

  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeConversation?._id; }, [activeConversation]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(async (data) => {
        if (!data.user) { router.push('/login'); return; }
        setUser(data.user);

        // Run migrations + E2EE in parallel (non-blocking)
        ensureTgId(data.user, setUser);
        bootstrapE2EE(data.user.id);

        // Load conversations + request count in parallel
        const [convRes, reqRes] = await Promise.all([
          fetch('/api/conversations').then(r => r.json()),
          fetch('/api/contact/requests').then(r => r.json()),
        ]);
        setConversations(convRes.conversations || []);
        setRequestCount(reqRes.count || 0);

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
        s.on('typing-start', ({ conversationId, senderName }) =>
          setTypingMap(p => ({ ...p, [conversationId]: senderName }))
        );
        s.on('typing-stop', ({ conversationId }) =>
          setTypingMap(p => { const n = { ...p }; delete n[conversationId]; return n; })
        );

        // New contact request
        s.on('new-contact-request', () => setRequestCount(c => c + 1));

        // Contact request accepted → refresh conversations
        s.on('contact-request-accepted', () => {
          fetch('/api/conversations').then(r => r.json()).then(d =>
            setConversations(d.conversations || [])
          );
        });

        return () => s.close();
      });
  }, [router]);

  const handleSelectConversation = useCallback((conv) => {
    setActive(conv);
    setUnreadCounts(p => ({ ...p, [conv._id]: 0 }));
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
        const other = data.conversation.participants?.find(p => p._id !== user?.id);
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

  const handleNavToConversation = useCallback((conversationId) => {
    const conv = conversations.find(c => c._id === conversationId);
    if (conv) handleSelectConversation(conv);
  }, [conversations, handleSelectConversation]);

  const handleConversationUpdate = useCallback((updated) => {
    setConversations(prev => {
      const list = prev.map(c => c._id === updated._id ? updated : c);
      return [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    });
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#05060f] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      <VoiceCallModal socket={socket} user={user} />
      <NotificationManager
        socket={socket}
        activeConversationId={activeConversation?._id}
        onNavigate={handleNavToConversation}
      />
      <div className="h-screen flex bg-[#05060f] text-white overflow-hidden">
        <ChatSidebar
          user={user}
          conversations={conversations}
          activeId={activeConversation?._id}
          onlineUsers={onlineUsers}
          onSelectConversation={handleSelectConversation}
          onStartDM={handleStartDM}
          typingMap={typingMap}
          unreadCounts={unreadCounts}
          requestCount={requestCount}
          socket={socket}
          onRequestAccepted={handleRequestAccepted}
        />
        <ChatWindow
          conversation={activeConversation}
          user={user}
          socket={socket}
          onlineUsers={onlineUsers}
          typing={typingMap[activeConversation?._id]}
          onConversationUpdate={handleConversationUpdate}
        />
      </div>
    </>
  );
}
