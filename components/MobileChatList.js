'use client';
import { useState } from 'react';
import { Search, MessageSquare, Hash, X } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-indigo-600','bg-violet-600','bg-pink-600',
  'bg-emerald-600','bg-amber-600','bg-cyan-600',
];

function Avatar({ name, size = 11, online = false }) {
  const c = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`w-${size} h-${size} rounded-full ${c} flex items-center justify-center font-bold text-white text-base`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      {online && (
        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0d0e1a]" />
      )}
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

// Loading skeleton for conversations
function ConvSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-11 h-11 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 rounded skeleton" />
        <div className="h-2.5 w-48 rounded skeleton" />
      </div>
      <div className="h-2.5 w-8 rounded skeleton" />
    </div>
  );
}

export default function MobileChatList({
  user,
  conversations,
  onlineUsers,
  typingMap,
  unreadCounts,
  onSelectConversation,
  onOpenSearch,
  loading = false,
}) {
  const [query, setQuery] = useState('');

  const getOther = (conv) =>
    conv.participants?.find(p => p._id !== user?.id) || { username: 'Unknown', _id: '' };

  const filtered = conversations.filter(c => {
    if (!query) return true;
    return getOther(c).username?.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-[#05060f]">
      {/* Search bar */}
      <div className="px-3 pt-2 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            id="chat-search-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-white/6 border border-white/8 rounded-2xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-content-area no-scrollbar">
        {/* Loading skeletons */}
        {loading && Array.from({ length: 6 }).map((_, i) => <ConvSkeleton key={i} />)}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-gray-700" />
            </div>
            <p className="font-semibold text-gray-400 text-base">
              {query ? 'No results found' : 'No conversations yet'}
            </p>
            <p className="text-sm text-gray-600 mt-1.5">
              {query ? 'Try a different name' : (
                <>
                  Tap{' '}
                  <button
                    onClick={onOpenSearch}
                    className="text-indigo-400 underline underline-offset-2"
                  >
                    <Hash size={12} className="inline" /> TG ID Search
                  </button>
                  {' '}to start chatting
                </>
              )}
            </p>
          </div>
        )}

        {/* Conversation rows */}
        {!loading && filtered.map(conv => {
          const other    = getOther(conv);
          const isOnline = onlineUsers?.has(other._id);
          const isTyping = !!typingMap?.[conv._id];
          const lastMsg  = conv.lastMessage;
          const unread   = unreadCounts?.[conv._id] || 0;

          return (
            <button
              key={conv._id}
              id={`conv-${conv._id}`}
              onClick={() => onSelectConversation(conv)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition-colors text-left border-b border-white/[0.04]"
            >
              <Avatar name={other.username} size={11} online={isOnline} />

              <div className="flex-1 min-w-0">
                {/* Name + time */}
                <div className="flex items-center justify-between gap-2">
                  <p className={`font-semibold text-sm truncate leading-tight ${unread ? 'text-white' : 'text-gray-200'}`}>
                    {other.username}
                  </p>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {lastMsg?.createdAt && (
                      <span className={`text-[11px] ${unread ? 'text-indigo-400' : 'text-gray-600'}`}>
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

                {/* TG ID */}
                {other.tgId && (
                  <p className="text-indigo-400/50 text-[10px] font-mono truncate leading-none mt-0.5">
                    @{other.tgId}
                  </p>
                )}

                {/* Last message / typing */}
                <p className={`text-xs truncate mt-1 ${unread ? 'text-white/80 font-medium' : 'text-gray-500'}`}>
                  {isTyping ? (
                    <span className="text-indigo-400 italic">typing…</span>
                  ) : lastMsg?.text ? (
                    <>
                      {lastMsg.senderName === user?.username && (
                        <span className="text-gray-600">You: </span>
                      )}
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

        {/* Bottom padding so last item clears the bottom nav */}
        <div className="h-3" />
      </div>
    </div>
  );
}
