'use client';
import { useState, useEffect, useCallback } from 'react';
import { Check, X, UserPlus, Bell } from 'lucide-react';

const AVATAR_COLORS = [
  'bg-indigo-600','bg-violet-600','bg-pink-600',
  'bg-emerald-600','bg-amber-600','bg-cyan-600',
];

function Avatar({ name }) {
  const c = AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length];
  return (
    <div className={`w-12 h-12 rounded-full ${c} flex items-center justify-center font-bold text-white text-lg flex-shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 rounded skeleton" />
        <div className="h-2.5 w-20 rounded skeleton" />
      </div>
      <div className="flex gap-2">
        <div className="w-10 h-10 rounded-2xl skeleton" />
        <div className="w-10 h-10 rounded-2xl skeleton" />
      </div>
    </div>
  );
}

export default function MobileRequestsScreen({ user, socket, onAccepted, onRequestCountChange }) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState({});  // { [requestId]: 'accept'|'decline' }

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/contact/requests')
      .then(r => r.json())
      .then(d => {
        setRequests(d.requests || []);
        onRequestCountChange?.(d.count || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [onRequestCountChange]);

  useEffect(() => { load(); }, [load]);

  // Live: new request arrives
  useEffect(() => {
    if (!socket) return;
    const handler = () => load();
    socket.on('new-contact-request', handler);
    return () => socket.off('new-contact-request', handler);
  }, [socket, load]);

  const accept = async (requestId) => {
    setActing(a => ({ ...a, [requestId]: 'accept' }));
    try {
      const res  = await fetch('/api/contact/accept', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (res.ok && data.conversation) {
        setRequests(prev => prev.filter(r => r._id !== requestId));
        onRequestCountChange?.(c => Math.max(0, c - 1));
        socket?.emit('contact-request-accepted', {
          recipientId: data.conversation.participants?.find(p => p._id !== user?.id)?._id,
        });
        onAccepted?.(data.conversation);
      }
    } finally {
      setActing(a => { const n = { ...a }; delete n[requestId]; return n; });
    }
  };

  const decline = async (requestId) => {
    setActing(a => ({ ...a, [requestId]: 'decline' }));
    try {
      await fetch('/api/contact/decline', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ requestId }),
      });
      setRequests(prev => prev.filter(r => r._id !== requestId));
      onRequestCountChange?.(c => Math.max(0, c - 1));
    } finally {
      setActing(a => { const n = { ...a }; delete n[requestId]; return n; });
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#05060f]">
      <div className="flex-content-area no-scrollbar">

        {/* Loading */}
        {loading && Array.from({ length: 4 }).map((_, i) => <RequestSkeleton key={i} />)}

        {/* Empty state */}
        {!loading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-4">
              <Bell size={32} className="text-gray-700" />
            </div>
            <p className="font-semibold text-gray-400 text-base">No pending requests</p>
            <p className="text-sm text-gray-600 mt-1.5">
              When someone sends you a contact request, it will appear here.
            </p>
          </div>
        )}

        {/* Section label */}
        {!loading && requests.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-2">
            <UserPlus size={14} className="text-indigo-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {requests.length} pending request{requests.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Request cards */}
        {!loading && requests.map(req => {
          const isAccepting = acting[req._id] === 'accept';
          const isDeclining = acting[req._id] === 'decline';
          const busy = !!acting[req._id];
          const sender = req.sender || {};

          return (
            <div
              key={req._id}
              className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] bg-white/[0.015]"
            >
              <Avatar name={sender.username} />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{sender.username}</p>
                {sender.tgId && (
                  <p className="text-indigo-400 text-[11px] font-mono truncate mt-0.5">@{sender.tgId}</p>
                )}
                <p className="text-gray-600 text-[11px] mt-0.5">Wants to message you</p>
              </div>

              {/* Accept */}
              <button
                id={`accept-req-${req._id}`}
                onClick={() => accept(req._id)}
                disabled={busy}
                className="w-10 h-10 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                title="Accept"
              >
                {isAccepting
                  ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <Check size={17} />
                }
              </button>

              {/* Decline */}
              <button
                id={`decline-req-${req._id}`}
                onClick={() => decline(req._id)}
                disabled={busy}
                className="w-10 h-10 rounded-2xl bg-red-500/10 hover:bg-red-600/30 text-red-500 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                title="Decline"
              >
                {isDeclining
                  ? <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                  : <X size={17} />
                }
              </button>
            </div>
          );
        })}

        <div className="h-3" />
      </div>
    </div>
  );
}
