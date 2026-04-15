'use client';
import { useState, useRef, useCallback } from 'react';
import { Search, UserPlus, Check, X, Hash, User } from 'lucide-react';

function Avatar({ name, size = 12 }) {
  const colors = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600','bg-cyan-600'];
  const c = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full ${c} flex-shrink-0 flex items-center justify-center font-bold text-white text-lg`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

/**
 * TgIdSearchPanel
 * Searches users by TG ID (@tg_XXXXXX) or username.
 * Shows a profile card with Add Contact button.
 * Props:
 *   onAddContact(userId, tgId) — triggered when user clicks "Add Contact"
 *   onClose()                 — close the panel
 */
export default function TgIdSearchPanel({ onAddContact, onClose }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);         // array of user objects
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState({});         // { userId: 'sending'|'sent'|'error'|string }
  const [searchType, setSearchType] = useState(null);   // 'tgid' | 'username'
  const [touched, setTouched]   = useState(false);
  const timer = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.replace('@','').length < 2) {
      setResults([]);
      setSearchType(null);
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`/api/user/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.users || []);
      setSearchType(data.type || 'username');
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setTouched(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(val), 350);
  };

  const sendRequest = async (targetUser) => {
    setStatus(s => ({ ...s, [targetUser._id]: 'sending' }));
    try {
      const res  = await fetch('/api/contact/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tgId: targetUser.tgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(s => ({ ...s, [targetUser._id]: data.error || 'Error' }));
      } else {
        setStatus(s => ({ ...s, [targetUser._id]: 'sent' }));
        onAddContact?.(data.conversation);
      }
    } catch {
      setStatus(s => ({ ...s, [targetUser._id]: 'Error' }));
    }
  };

  const isTgQuery = query.startsWith('@') || /^tg_/i.test(query);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <div>
          <h2 className="font-bold text-white text-sm">Add by TG ID</h2>
          <p className="text-xs text-gray-500">Search @tg_XXXXXX or username</p>
        </div>
      </div>

      {/* ── Search input ────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          {isTgQuery
            ? <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
            : <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          }
          <input
            autoFocus
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="@tg_XXXXXX or username"
            className={`w-full bg-white/5 border rounded-2xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
              isTgQuery ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 focus:border-indigo-500/40'
            }`}
          />
        </div>

        {/* Hint pill */}
        {!query && (
          <div className="mt-3 flex flex-wrap gap-2">
            {['@tg_A7K9X2', 'username'].map(hint => (
              <button
                key={hint}
                onClick={() => { setQuery(hint.startsWith('@') ? hint : ''); }}
                className="text-[11px] text-indigo-400 border border-indigo-500/20 bg-indigo-500/5 rounded-full px-3 py-1 hover:bg-indigo-500/15 transition-colors"
              >
                {hint.startsWith('@') ? `Search by TG ID e.g. ${hint}` : 'Or search by username'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* No results */}
        {!loading && touched && results.length === 0 && query.replace('@','').length >= 2 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-semibold text-sm">No user found</p>
            <p className="text-gray-600 text-xs mt-1">
              {isTgQuery
                ? 'Check the TG ID and try again'
                : 'Try searching by TG ID (@tg_XXXXXX)'}
            </p>
          </div>
        )}

        {/* Results list */}
        {!loading && results.map(u => {
          const st = status[u._id];
          return (
            <div
              key={u._id}
              className="flex items-center gap-3 p-4 bg-white/3 border border-white/8 rounded-2xl mb-3 hover:border-white/15 transition-colors"
            >
              <Avatar name={u.username} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{u.username}</p>
                {u.tgId && (
                  <p className="text-indigo-400 text-xs mt-0.5 font-mono">@{u.tgId}</p>
                )}
                {u.bio && (
                  <p className="text-gray-500 text-xs mt-1 truncate">{u.bio}</p>
                )}
              </div>

              {/* Add Contact button */}
              {!st && (
                <button
                  onClick={() => sendRequest(u)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                  title="Send contact request"
                >
                  <UserPlus size={13} />
                  Add
                </button>
              )}
              {st === 'sending' && (
                <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
              )}
              {st === 'sent' && (
                <div className="flex items-center gap-1 text-green-400 text-xs font-semibold flex-shrink-0">
                  <Check size={14} /> Sent
                </div>
              )}
              {st && st !== 'sending' && st !== 'sent' && (
                <p className="text-red-400 text-[10px] flex-shrink-0 max-w-[80px] text-right leading-tight">{st}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom info ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-white/5 bg-black/20 flex-shrink-0">
        <p className="text-[11px] text-gray-600 leading-relaxed text-center">
          Share your own TG ID from the profile panel so others can find you.
          Phone numbers are never used or exposed.
        </p>
      </div>
    </div>
  );
}
