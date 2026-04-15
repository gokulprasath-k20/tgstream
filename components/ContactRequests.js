'use client';
import { useState, useEffect, useCallback } from 'react';
import { Check, X, MessageSquare, UserCheck, Clock } from 'lucide-react';

function Avatar({ name }) {
  const colors = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600','bg-cyan-600'];
  const c = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-12 h-12 rounded-full ${c} flex-shrink-0 flex items-center justify-center font-bold text-white text-lg`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ContactRequests({ user, socket, onAccepted, onConversationsUpdate }) {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [processing, setProc]     = useState({});  // { convId: 'accepting' | 'rejecting' }
  const [previews, setPreviews]   = useState({});  // { convId: lastMessage text }

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/contact/requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Real-time: new request arrives
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadRequests();
    socket.on('new-contact-request', handler);
    return () => socket.off('new-contact-request', handler);
  }, [socket, loadRequests]);

  // Load last message preview for each request
  useEffect(() => {
    requests.forEach(async (req) => {
      if (previews[req._id]) return;
      try {
        const res  = await fetch(`/api/conversations/${req._id}/messages?limit=1`);
        const data = await res.json();
        const last = data.messages?.[data.messages.length - 1];
        if (last) {
          setPreviews(p => ({
            ...p,
            [req._id]: last.type === 'audio'    ? '🎤 Voice note'
                     : last.type === 'image'    ? '📷 Photo'
                     : last.type === 'video'    ? '🎥 Video'
                     : last.type === 'document' ? `📎 ${last.fileName}`
                     : last.text || '',
          }));
        }
      } catch {}
    });
  }, [requests]);

  const getOther = (conv) =>
    conv.participants?.find(p => p._id !== user.id) || { username: 'Unknown' };

  const accept = async (convId) => {
    setProc(p => ({ ...p, [convId]: 'accepting' }));
    try {
      const res  = await fetch('/api/contact/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      });
      const data = await res.json();
      if (data.conversation) {
        setRequests(r => r.filter(req => req._id !== convId));
        onAccepted?.(data.conversation);

        // Notify other side via socket
        const other = requests.find(r => r._id === convId);
        if (other) {
          const otherUser = getOther(other);
          socket?.emit('contact-request-accepted', { recipientId: otherUser._id });
        }
      }
    } finally {
      setProc(p => { const n = { ...p }; delete n[convId]; return n; });
    }
  };

  const reject = async (convId) => {
    setProc(p => ({ ...p, [convId]: 'rejecting' }));
    try {
      await fetch('/api/contact/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId }),
      });
      setRequests(r => r.filter(req => req._id !== convId));
    } finally {
      setProc(p => { const n = { ...p }; delete n[convId]; return n; });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <UserCheck size={28} className="text-gray-600" />
        </div>
        <p className="font-semibold text-sm text-gray-400">No message requests</p>
        <p className="text-xs text-gray-600 mt-1.5">When someone new messages you, it appears here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Info banner */}
      <div className="mx-3 mt-3 mb-4 bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-xs text-indigo-300 flex items-start gap-2">
        <MessageSquare size={14} className="flex-shrink-0 mt-0.5" />
        <span>Accept requests to add people to your contacts and start chatting.</span>
      </div>

      {requests.map(req => {
        const other     = getOther(req);
        const preview   = previews[req._id];
        const isProc    = processing[req._id];

        return (
          <div
            key={req._id}
            className="px-4 py-4 border-b border-white/5 hover:bg-white/3 transition-colors"
          >
            {/* Top row: avatar + info */}
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={other.username} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">{other.username}</p>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Clock size={10} />
                    <span>{timeAgo(req.updatedAt)}</span>
                  </div>
                </div>
                {preview ? (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{preview}</p>
                ) : (
                  <p className="text-xs text-gray-600 mt-0.5 italic">Wants to message you</p>
                )}
              </div>
            </div>

            {/* Accept / Reject buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => accept(req._id)}
                disabled={!!isProc}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {isProc === 'accepting'
                  ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <><Check size={13} /> Accept</>
                }
              </button>
              <button
                onClick={() => reject(req._id)}
                disabled={!!isProc}
                className="flex-1 py-2 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-50 text-gray-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {isProc === 'rejecting'
                  ? <div className="w-3 h-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                  : <><X size={13} /> Decline</>
                }
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
