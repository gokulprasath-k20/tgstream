'use client';
import { useState, useEffect } from 'react';
import { Users, MessageSquare, Phone, Hash } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-indigo-600','bg-violet-600','bg-pink-600',
  'bg-emerald-600','bg-amber-600','bg-cyan-600',
];

function Avatar({ name, online = false }) {
  const c = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div className="relative flex-shrink-0">
      <div className={`w-12 h-12 rounded-full ${c} flex items-center justify-center font-bold text-white text-lg`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
      {online && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#05060f]" />
      )}
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-28 rounded skeleton" />
        <div className="h-2.5 w-20 rounded skeleton" />
      </div>
    </div>
  );
}

export default function MobileContactsScreen({
  user,
  onlineUsers,
  onStartDM,
  onOpenSearch,
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [query, setQuery]       = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/contact/list')
      .then(r => r.json())
      .then(d => { setContacts(d.contacts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = contacts.filter(c =>
    !query || c.username?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#05060f]">
      {/* Search */}
      <div className="px-3 pt-2 pb-2 flex-shrink-0">
        <input
          id="contacts-search-input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="w-full bg-white/6 border border-white/8 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* List */}
      <div className="flex-content-area no-scrollbar">

        {/* Skeletons */}
        {loading && Array.from({ length: 5 }).map((_, i) => <ContactSkeleton key={i} />)}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4">
              <Users size={32} className="text-gray-700" />
            </div>
            <p className="font-semibold text-gray-400 text-base">
              {query ? 'No contacts found' : 'No contacts yet'}
            </p>
            <p className="text-sm text-gray-600 mt-1.5">
              {query ? 'Try a different name' : (
                <>
                  Use{' '}
                  <button
                    onClick={onOpenSearch}
                    className="text-indigo-400 underline underline-offset-2"
                  >
                    <Hash size={12} className="inline" /> TG ID Search
                  </button>
                  {' '}to add people
                </>
              )}
            </p>
          </div>
        )}

        {/* Contact rows */}
        {!loading && filtered.map(contact => {
          const isOnline = onlineUsers?.has(contact._id);
          return (
            <div
              key={contact._id}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]"
            >
              <Avatar name={contact.username} online={isOnline} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate leading-tight">
                  {contact.username}
                </p>
                {contact.tgId && (
                  <p className="text-indigo-400 text-[11px] font-mono truncate mt-0.5">
                    @{contact.tgId}
                  </p>
                )}
                <p className={`text-[11px] mt-0.5 ${isOnline ? 'text-green-400' : 'text-gray-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  id={`msg-contact-${contact._id}`}
                  onClick={() => onStartDM(contact._id)}
                  className="w-10 h-10 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 flex items-center justify-center transition-all active:scale-90"
                  title="Message"
                >
                  <MessageSquare size={16} />
                </button>
                <button
                  id={`call-contact-${contact._id}`}
                  onClick={() => window.__initiateVoiceCall?.(contact._id, contact.username)}
                  className="w-10 h-10 rounded-2xl bg-green-600/20 hover:bg-green-600/40 text-green-400 flex items-center justify-center transition-all active:scale-90"
                  title="Voice call"
                >
                  <Phone size={16} />
                </button>
              </div>
            </div>
          );
        })}

        <div className="h-3" />
      </div>
    </div>
  );
}
