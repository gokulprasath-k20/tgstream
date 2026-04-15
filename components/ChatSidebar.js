'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, ArrowLeft, MessageSquare, Users, Phone, Hash, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ContactRequests from './ContactRequests';
import dynamic from 'next/dynamic';

const TgIdSearchPanel = dynamic(() => import('./TgIdSearchPanel'), { ssr: false });
const ProfilePanel    = dynamic(() => import('./ProfilePanel'),    { ssr: false });

function Avatar({ name, size = 10, online = false }) {
  const colors = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600','bg-cyan-600'];
  const c = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`w-${size} h-${size} rounded-full ${c} flex items-center justify-center font-bold text-white text-sm`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      {online && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0d0e1a]" />}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr), now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const TABS = [
  { key: 'chats',    label: 'Chats'    },
  { key: 'requests', label: 'Requests' },
  { key: 'contacts', label: 'Contacts' },
];

export default function ChatSidebar({
  user,
  conversations,
  activeId,
  onlineUsers,
  onSelectConversation,
  onStartDM,
  typingMap,
  unreadCounts,
  requestCount,
  socket,
  onRequestAccepted,
}) {
  const router = useRouter();
  const [tab, setTab]             = useState('chats');
  const [query, setQuery]         = useState('');
  const [panel, setPanel]         = useState(null);    // null | 'search' | 'profile'
  const [contacts, setContacts]   = useState([]);
  const searchTimer = useRef(null);

  // Load contacts when Contacts tab active
  useEffect(() => {
    if (tab !== 'contacts') return;
    fetch('/api/contact/list')
      .then(r => r.json())
      .then(d => setContacts(d.contacts || []));
  }, [tab]);

  const getOther = (conv) =>
    conv.participants?.find(p => p._id !== user.id) || { username: 'Unknown', _id: '' };

  const filteredConvos = conversations.filter(c => {
    if (!query) return true;
    const other = getOther(c);
    return other.username?.toLowerCase().includes(query.toLowerCase());
  });

  const filteredContacts = contacts.filter(c =>
    !query || c.username?.toLowerCase().includes(query.toLowerCase())
  );

  const totalUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);

  // When TG ID search finds a contact and request is sent
  const handleContactAdded = useCallback((conversation) => {
    if (conversation) {
      onStartDM?.(conversation.participants?.find(p => p._id !== user.id)?._id);
    }
    setPanel(null);
    setTab('chats');
  }, [onStartDM, user.id]);

  // If a panel is open, render it fullscreen in the sidebar
  if (panel === 'search') {
    return (
      <div className="flex flex-col w-[340px] flex-shrink-0 border-r border-white/8 bg-[#0a0b15] h-full">
        <TgIdSearchPanel
          onAddContact={handleContactAdded}
          onClose={() => setPanel(null)}
        />
      </div>
    );
  }

  if (panel === 'profile') {
    return (
      <div className="flex flex-col w-[340px] flex-shrink-0 border-r border-white/8 bg-[#0a0b15] h-full">
        <ProfilePanel
          user={user}
          onClose={() => setPanel(null)}
          onPrivacyChange={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[340px] flex-shrink-0 border-r border-white/8 bg-[#0a0b15]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-white/8">
        <button
          onClick={() => router.push('/dashboard')}
          title="Dashboard"
          className="p-2 rounded-xl hover:bg-white/8 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={17} />
        </button>

        {/* Avatar + TG ID — click to open profile */}
        <button
          onClick={() => setPanel('profile')}
          className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left group"
          title="View profile"
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              {user?.username?.[0]?.toUpperCase()}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="font-bold text-white text-sm truncate leading-tight">{user?.username}</p>
            {user?.tgId ? (
              <p className="text-indigo-400 text-[10px] font-mono truncate leading-tight">@{user.tgId}</p>
            ) : (
              <p className="text-gray-600 text-[10px]">no TG ID</p>
            )}
          </div>
        </button>

        <div className="flex gap-1">
          {/* Open TG ID search */}
          <button
            onClick={() => setPanel('search')}
            title="Find by TG ID"
            className="p-2 rounded-xl hover:bg-white/8 text-gray-400 hover:text-indigo-400 transition-colors"
          >
            <Hash size={17} />
          </button>
          {/* Compose new chat */}
          <button
            onClick={() => { setTab('chats'); setQuery(''); setPanel(null); }}
            title="New chat"
            className="p-2 rounded-xl hover:bg-white/8 text-gray-400 hover:text-white transition-colors"
          >
            <Plus size={17} />
          </button>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/8">
        {TABS.map(({ key, label }) => {
          const badge = key === 'requests' ? requestCount : key === 'chats' ? totalUnread : 0;
          return (
            <button
              key={key}
              onClick={() => { setTab(key); setQuery(''); }}
              className={`flex-1 py-2.5 text-xs font-semibold relative transition-colors ${
                tab === key
                  ? 'text-indigo-400 border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
              {badge > 0 && (
                <span className="absolute top-1 right-3 min-w-[16px] h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search bar (only for Chats + Contacts tabs) ─────────────────────── */}
      {tab !== 'requests' && (
        <div className="px-3 py-2.5 border-b border-white/5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tab === 'chats' ? 'Filter conversations…' : 'Filter contacts…'}
              className="w-full bg-white/5 border border-white/8 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>
      )}

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ══ REQUESTS TAB ══ */}
        {tab === 'requests' && (
          <ContactRequests
            user={user}
            socket={socket}
            onAccepted={(conv) => { onRequestAccepted?.(conv); setTab('chats'); }}
          />
        )}

        {/* ══ CONTACTS TAB ══ */}
        {tab === 'contacts' && (
          <div>
            {filteredContacts.length === 0 && (
              <div className="text-center py-14 px-6">
                <Users size={34} className="mx-auto mb-3 text-gray-700" />
                <p className="font-semibold text-sm text-gray-500">No contacts yet</p>
                <p className="text-xs mt-1 text-gray-700">
                  Use <button onClick={() => setPanel('search')} className="text-indigo-400 underline"># TG ID search</button> to add people
                </p>
              </div>
            )}
            {filteredContacts.map(contact => (
              <div key={contact._id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                <Avatar name={contact.username} online={onlineUsers?.has(contact._id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm">{contact.username}</p>
                  {contact.tgId && (
                    <p className="text-indigo-400 text-[10px] font-mono">@{contact.tgId}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { onStartDM(contact._id); setTab('chats'); }}
                    className="w-8 h-8 rounded-lg bg-white/8 hover:bg-indigo-600/30 text-gray-400 hover:text-indigo-300 flex items-center justify-center transition-colors"
                    title="Message"
                  >
                    <MessageSquare size={13} />
                  </button>
                  <button
                    onClick={() => window.__initiateVoiceCall?.(contact._id, contact.username)}
                    className="w-8 h-8 rounded-lg bg-white/8 hover:bg-green-600/30 text-gray-400 hover:text-green-400 flex items-center justify-center transition-colors"
                    title="Voice call"
                  >
                    <Phone size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ CHATS TAB ══ */}
        {tab === 'chats' && (
          <div>
            {filteredConvos.length === 0 && (
              <div className="text-center py-14 px-6">
                <MessageSquare size={34} className="mx-auto mb-3 text-gray-700" />
                <p className="font-semibold text-sm text-gray-500">No conversations yet</p>
                <p className="text-xs mt-1 text-gray-700">
                  <button onClick={() => setPanel('search')} className="text-indigo-400 underline">
                    Search by TG ID
                  </button>
                  {' '}to start chatting
                </p>
              </div>
            )}

            {filteredConvos.map(conv => {
              const other    = getOther(conv);
              const isOnline = onlineUsers?.has(other._id);
              const isActive = conv._id === activeId;
              const isTyping = !!typingMap?.[conv._id];
              const lastMsg  = conv.lastMessage;
              const unread   = unreadCounts?.[conv._id] || 0;

              return (
                <button
                  key={conv._id}
                  onClick={() => onSelectConversation(conv)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left border-b border-white/5 ${
                    isActive
                      ? 'bg-indigo-600/15 border-l-2 border-l-indigo-500'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <Avatar name={other.username} size={10} online={isOnline} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate leading-tight">{other.username}</p>
                        {other.tgId && (
                          <p className="text-indigo-400/60 text-[9px] font-mono truncate">@{other.tgId}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        {lastMsg?.createdAt && (
                          <span className={`text-[10px] ${unread ? 'text-indigo-400' : 'text-gray-600'}`}>
                            {timeAgo(lastMsg.createdAt)}
                          </span>
                        )}
                        {unread > 0 && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${unread ? 'text-white font-medium' : 'text-gray-500'}`}>
                      {isTyping ? (
                        <span className="text-indigo-400 italic">typing…</span>
                      ) : lastMsg?.text ? (
                        <>
                          {lastMsg.senderName === user.username && <span className="text-gray-600">You: </span>}
                          {lastMsg.text}
                        </>
                      ) : (
                        <span className="opacity-40">No messages yet</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer: TG ID pill ─────────────────────────────────────────────── */}
      <div
        className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/3 transition-colors"
        onClick={() => setPanel('profile')}
        title="Open profile"
      >
        <div className="flex items-center gap-2 min-w-0">
          <UserCircle size={14} className="text-gray-600 flex-shrink-0" />
          {user?.tgId ? (
            <span className="text-indigo-400 text-[11px] font-mono truncate">@{user.tgId}</span>
          ) : (
            <span className="text-gray-600 text-[11px] italic">Setup TG ID →</span>
          )}
        </div>
        <span className="text-gray-700 text-[10px]">Profile</span>
      </div>
    </div>
  );
}
