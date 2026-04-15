'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Bell } from 'lucide-react';

// ── Individual Toast ─────────────────────────────────────────────────────────
function Toast({ id, senderName, preview, onClose, onClick }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 bg-[#1a1b2e] border border-white/15 rounded-2xl px-4 py-3 shadow-2xl cursor-pointer hover:bg-[#1e1f33] transition-colors max-w-[340px] animate-slide-in-right"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center font-bold text-sm text-white">
        {senderName?.[0]?.toUpperCase() || '?'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-tight">{senderName}</p>
        <p className="text-xs text-gray-400 truncate mt-0.5">{preview}</p>
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Main NotificationManager ─────────────────────────────────────────────────
// Render once at app level (app/chat/page.js)
export default function NotificationManager({ socket, activeConversationId, onNavigate }) {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const permRef    = useRef('default');

  // Request browser notification permission once
  useEffect(() => {
    if (!('Notification' in window)) return;
    permRef.current = Notification.permission;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(p => { permRef.current = p; });
    }
  }, []);

  const addToast = useCallback((senderName, preview, conversationId) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, senderName, preview, conversationId }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Build a user-friendly message preview from message object
  const buildPreview = (message) => {
    switch (message?.type) {
      case 'audio':    return '🎤 Voice note';
      case 'image':    return '📷 Photo';
      case 'video':    return '🎥 Video';
      case 'document': return `📎 ${message.fileName || 'Document'}`;
      default:         return message?.text || 'New message';
    }
  };

  // Listen for incoming DMs
  useEffect(() => {
    if (!socket) return;

    const handler = ({ conversationId, message }) => {
      // Skip if this is the currently open conversation
      if (conversationId === activeConversationId) return;

      const sender  = message?.senderName || 'Someone';
      const preview = buildPreview(message);

      // Browser notification (fires when tab is hidden / not focused)
      if (permRef.current === 'granted' && document.hidden) {
        try {
          const n = new Notification(sender, {
            body: preview,
            icon: '/favicon.ico',
            tag:  conversationId,    // de-duplicates per conversation
            renotify: true,
          });
          n.onclick = () => {
            window.focus();
            onNavigate?.(conversationId);
            n.close();
          };
          return; // don't ALSO show in-app toast when showing native notif
        } catch { /* Notification API might not be available in all contexts */ }
      }

      // In-app toast (when tab is focused)
      addToast(sender, preview, conversationId);
    };

    socket.on('receive-dm', handler);
    return () => socket.off('receive-dm', handler);
  }, [socket, activeConversationId, addToast, onNavigate]);

  // Render toasts in top-right corner
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
            id={t.id}
            senderName={t.senderName}
            preview={t.preview}
            onClose={() => removeToast(t.id)}
            onClick={() => {
              onNavigate?.(t.conversationId);
              removeToast(t.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
