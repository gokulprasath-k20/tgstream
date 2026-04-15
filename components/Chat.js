'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, Smile } from 'lucide-react';

const QUICK_EMOJIS = ['😀','😂','❤️','👍','🔥','😭','🤔','🎉','💯','😎'];

export default function Chat({ socket, roomId, username }) {
  const [message, setMessage]   = useState('');
  const [messages, setMessages] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef   = useRef(null);

  // Load history + subscribe to real-time messages
  useEffect(() => {
    if (!socket || !roomId) return;

    fetch(`/api/chat?roomId=${roomId}`)
      .then(r => r.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages.map(m => ({
            username: m.username || m.senderName,
            message:  m.text,
            timestamp: m.timestamp || new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })));
        }
      });

    const onMessage = (msg) => setMessages(prev => [...prev, msg]);
    socket.on('receive-message', onMessage);
    return () => socket.off('receive-message', onMessage);
  }, [socket, roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim() || !socket) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgData = { roomId, message: message.trim(), username, timestamp };

    socket.emit('send-message', msgData);

    // Persist to DB
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, message: message.trim(), timestamp }),
      });
    } catch {}

    setMessage('');
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0b15] overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            No messages yet. Say hi! 👋
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine = msg.username === username;
          return (
            <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow ${
                isMine
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white/8 text-white rounded-bl-sm border border-white/8'
              }`}>
                {!isMine && (
                  <p className="text-[10px] font-bold opacity-70 mb-0.5 text-indigo-300">
                    {msg.username}
                  </p>
                )}
                <p className="leading-relaxed break-words">{msg.message}</p>
                <p className="text-[10px] opacity-50 text-right mt-0.5">{msg.timestamp}</p>
              </div>
            </div>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* Quick emojis */}
      {showEmoji && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-white/8 bg-[#0f1020]">
          {QUICK_EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => { setMessage(m => m + e); setShowEmoji(false); inputRef.current?.focus(); }}
              className="text-xl hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-3 border-t border-white/8"
      >
        <button
          type="button"
          onClick={() => setShowEmoji(s => !s)}
          className={`p-2 rounded-lg transition-colors ${showEmoji ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
          <Smile size={18} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
