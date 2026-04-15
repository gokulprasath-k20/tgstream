'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCheck, MessageSquare, Download, FileText, Play, Pause, Phone } from 'lucide-react';
import MessageInput from './MessageInput';

// ── Helpers ──────────────────────────────────────────────────────────────────
function Avatar({ name }) {
  const cols = ['bg-indigo-600','bg-violet-600','bg-pink-600','bg-emerald-600','bg-amber-600','bg-cyan-600'];
  const c = cols[(name?.charCodeAt(0) || 0) % cols.length];
  return (
    <div className={`w-8 h-8 rounded-full ${c} flex-shrink-0 flex items-center justify-center font-bold text-white text-sm`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

const fmtTime  = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtSecs  = (s) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
const fmtSize  = (b) => b < 1024 ? `${b} B` : b < 1024**2 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024**2).toFixed(1)} MB`;

function fmtDate(d) {
  const date = new Date(d), today = new Date(), yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yest.toDateString())  return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDate(msgs) {
  const out = []; let last = null;
  for (const m of msgs) {
    const d = fmtDate(m.createdAt);
    if (d !== last) { out.push({ type: 'date', label: d, key: `d-${m._id}` }); last = d; }
    out.push({ type: 'message', ...m });
  }
  return out;
}

// ── Audio Player (for voice notes) ──────────────────────────────────────────
function AudioBubble({ audioUrl, duration, isMine }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const ref = useRef(null);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) { el.pause(); }
    else { el.play(); }
    setPlaying(!playing);
  };

  const bars = [4,8,6,12,9,14,8,11,5,9,7,13,6,10,8,7,11];

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio
        ref={ref}
        src={audioUrl}
        onTimeUpdate={() => {
          const el = ref.current;
          if (!el?.duration) return;
          setProgress(el.currentTime / el.duration);
          setElapsed(Math.round(el.currentTime));
        }}
        onEnded={() => { setPlaying(false); setProgress(0); setElapsed(0); }}
      />
      {/* Play/Pause */}
      <button
        onClick={toggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-indigo-600 hover:bg-indigo-500'} transition-colors`}
      >
        {playing ? <Pause size={14} fill="white" className="text-white" /> : <Play size={14} fill="white" className="text-white ml-0.5" />}
      </button>

      {/* Waveform */}
      <div className="flex gap-0.5 items-center h-7 flex-1">
        {bars.map((h, i) => {
          const filled = (i / bars.length) < progress;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors ${filled ? (isMine ? 'bg-white' : 'bg-indigo-400') : 'bg-white/25'}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className="text-[10px] opacity-60 tabular-nums flex-shrink-0">
        {fmtSecs(progress ? elapsed : (duration || 0))}
      </span>
    </div>
  );
}

// ── Image Bubble ─────────────────────────────────────────────────────────────
function ImageBubble({ fileUrl }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img
        src={fileUrl}
        alt="Shared image"
        className="max-w-full max-h-64 rounded-xl object-cover cursor-zoom-in"
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={fileUrl} alt="Full size" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}

// ── Document Bubble ──────────────────────────────────────────────────────────
function DocumentBubble({ fileUrl, fileName, fileSize, isMine }) {
  return (
    <a
      href={fileUrl}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl min-w-[220px] ${isMine ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 hover:bg-white/10'} transition-colors`}
      onClick={e => e.stopPropagation()}
    >
      <div className="w-10 h-10 rounded-lg bg-blue-500/30 flex items-center justify-center flex-shrink-0">
        <FileText size={20} className="text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        {fileSize && <p className="text-[10px] opacity-50">{fmtSize(fileSize)}</p>}
      </div>
      <Download size={16} className="flex-shrink-0 opacity-60" />
    </a>
  );
}

// ── Message Bubble (renders correct content for each type) ───────────────────
function MessageBubble({ msg, isMine }) {
  const base = `${isMine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white/8 text-white rounded-bl-sm border border-white/8'} ${msg._optimistic ? 'opacity-70' : ''}`;

  const renderContent = () => {
    switch (msg.type) {
      case 'audio':
        return (
          <div className="px-3 py-2.5 rounded-2xl shadow-lg max-w-[280px]" style={{ background: isMine ? 'rgba(99,102,241,1)' : 'rgba(255,255,255,0.08)' }}>
            <AudioBubble audioUrl={msg.audioUrl} duration={msg.duration} isMine={isMine} />
            <p className={`text-[10px] mt-1.5 opacity-60 ${isMine ? 'text-right' : 'text-left'}`}>{fmtTime(msg.createdAt)}</p>
          </div>
        );

      case 'image':
        return (
          <div className="rounded-2xl overflow-hidden shadow-lg max-w-[300px]">
            <ImageBubble fileUrl={msg.fileUrl} />
            <div className={`px-3 py-1.5 flex items-center gap-1 justify-end ${isMine ? 'bg-indigo-600' : 'bg-white/8'}`}>
              <span className="text-[10px] opacity-60">{fmtTime(msg.createdAt)}</span>
              {isMine && !msg._optimistic && <CheckCheck size={11} className="opacity-60" />}
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="rounded-2xl overflow-hidden shadow-lg max-w-[300px]">
            <video src={msg.fileUrl} controls className="w-full max-h-56 bg-black" />
            <div className={`px-3 py-1.5 flex items-center gap-1 justify-end ${isMine ? 'bg-indigo-600' : 'bg-white/8'}`}>
              <span className="text-[10px] opacity-60">{fmtTime(msg.createdAt)}</span>
            </div>
          </div>
        );

      case 'document':
        return (
          <div className={`rounded-2xl shadow-lg px-3 py-2.5 max-w-[300px] ${isMine ? 'bg-indigo-600' : 'bg-white/8 border border-white/8'}`}>
            <DocumentBubble fileUrl={msg.fileUrl} fileName={msg.fileName} fileSize={msg.fileSize} isMine={isMine} />
            <div className="flex items-center gap-1 justify-end mt-1.5">
              <span className="text-[10px] opacity-60">{fmtTime(msg.createdAt)}</span>
              {isMine && !msg._optimistic && <CheckCheck size={11} className="opacity-60" />}
            </div>
          </div>
        );

      default: // 'text'
        return (
          <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-lg ${base}`}>
            <p className="leading-relaxed break-words">{msg.text}</p>
            <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
              <span className="text-[10px] opacity-60">{fmtTime(msg.createdAt)}</span>
              {isMine && !msg._optimistic && <CheckCheck size={12} className="opacity-60" />}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`flex items-end gap-2 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isMine && <Avatar name={msg.senderName} />}
      {renderContent()}
    </div>
  );
}

// ── Main ChatWindow ──────────────────────────────────────────────────────────
export default function ChatWindow({
  conversation,
  user,
  socket,
  onlineUsers,
  typing,
  onConversationUpdate,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(false);
  const bottomRef = useRef(null);

  const other = conversation?.participants?.find(p => p._id !== user?.id);

  // Load history when conversation changes
  useEffect(() => {
    if (!conversation?._id) { setMessages([]); return; }
    setLoading(true);
    fetch(`/api/conversations/${conversation._id}/messages`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setHasMore((d.messages || []).length === 60); setLoading(false); })
      .catch(() => setLoading(false));
  }, [conversation?._id]);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  // Load older
  const loadOlder = async () => {
    if (!messages.length || !hasMore) return;
    const res  = await fetch(`/api/conversations/${conversation._id}/messages?before=${messages[0]._id}&limit=60`);
    const data = await res.json();
    if (data.messages?.length) { setMessages(p => [...data.messages, ...p]); setHasMore(data.messages.length === 60); }
    else setHasMore(false);
  };

  // Real-time incoming DMs
  useEffect(() => {
    if (!socket || !conversation?._id) return;
    const handleDM = ({ conversationId, message }) => {
      if (conversationId !== conversation._id) return;
      setMessages(p => p.some(m => m._id === message._id) ? p : [...p, message]);
    };
    socket.on('receive-dm', handleDM);
    return () => socket.off('receive-dm', handleDM);
  }, [socket, conversation?._id]);

  // ── Generic "save + relay" helper ──────────────────────────────────────────
  const saveAndRelay = useCallback(async (body) => {
    const optimistic = {
      _id: `opt-${Date.now()}`,
      senderName: user.username,
      createdAt: new Date().toISOString(),
      _optimistic: true,
      ...body,
      text: body.text || '',
    };
    setMessages(p => [...p, optimistic]);

    try {
      const res  = await fetch(`/api/conversations/${conversation._id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.message) throw new Error('Save failed');

      setMessages(p => p.map(m => m._id === optimistic._id ? data.message : m));

      socket?.emit('send-dm', {
        conversationId: conversation._id,
        recipientId: other?._id,
        message: data.message,
      });

      onConversationUpdate?.({
        ...conversation,
        lastMessage: {
          text:       data.message.text || '',
          senderName: user.username,
          createdAt:  new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setMessages(p => p.filter(m => m._id !== optimistic._id));
    }
  }, [conversation, user, socket, other, onConversationUpdate]);

  const handleSend      = useCallback((text) => saveAndRelay({ type: 'text', text }), [saveAndRelay]);
  const handleSendMedia = useCallback((data) => saveAndRelay(data), [saveAndRelay]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-600">
        <div className="w-24 h-24 rounded-3xl bg-white/5 flex items-center justify-center">
          <MessageSquare size={40} className="opacity-30" />
        </div>
        <div className="text-center">
          <p className="font-bold text-white/40 text-lg">Select a conversation</p>
          <p className="text-sm mt-1 opacity-40">or start a new chat from the sidebar</p>
        </div>
      </div>
    );
  }

  const grouped  = groupByDate(messages);
  const isOnline = other && onlineUsers?.has(other._id);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#05060f]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-[#0a0b15] flex-shrink-0">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">
            {other?.username?.[0]?.toUpperCase() || '?'}
          </div>
          {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0a0b15]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white">{other?.username || 'Unknown'}</p>
          <p className="text-xs text-gray-400">
            {typing ? <span className="text-indigo-400 italic">typing…</span> : isOnline ? '🟢 Online' : 'Offline'}
          </p>
        </div>
        {/* Voice call button */}
        <button
          onClick={() => window.__initiateVoiceCall?.(other?._id, other?.username)}
          className="w-9 h-9 rounded-xl hover:bg-green-600/20 text-gray-400 hover:text-green-400 flex items-center justify-center transition-colors"
          title="Voice call"
        >
          <Phone size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {hasMore && (
          <button onClick={loadOlder} className="self-center text-xs text-indigo-400 hover:text-indigo-300 py-2 px-4 rounded-full bg-indigo-600/10 border border-indigo-500/20 mb-4 transition-colors">
            Load older messages
          </button>
        )}
        {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" /></div>}
        {!loading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-gray-600">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1 opacity-60">Say hi to {other?.username}! 👋</p>
          </div>
        )}

        {grouped.map(item => {
          if (item.type === 'date') {
            return (
              <div key={item.key} className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[11px] text-gray-500 font-medium px-2">{item.label}</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>
            );
          }
          return (
            <MessageBubble key={item._id} msg={item} isMine={item.senderName === user?.username} />
          );
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-end gap-2 mb-1">
            <Avatar name={other?.username} />
            <div className="bg-white/8 border border-white/8 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1 items-center h-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onSendMedia={handleSendMedia}
        socket={socket}
        conversationId={conversation._id}
        recipientId={other?._id}
      />
    </div>
  );
}
