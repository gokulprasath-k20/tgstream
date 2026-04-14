'use client';
import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function Chat({ socket, roomId, username }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    // Load History
    fetch(`/api/chat?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          const history = data.messages.map(m => ({
            username: m.username,
            message: m.text,
            timestamp: m.timestamp
          }));
          setMessages(history);
        }
      });

    socket.on('receive-message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => socket.off('receive-message');
  }, [socket, roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (message.trim() && socket) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgData = {
        roomId,
        message: message.trim(),
        username,
        timestamp
      };

      socket.emit('send-message', msgData);

      try {
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, message: message.trim(), timestamp }),
        });
      } catch (err) {}

      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-card" style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group Chat</h3>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ 
            alignSelf: msg.username === username ? 'flex-end' : 'flex-start',
            maxWidth: '85%'
          }}>
            <div style={{ padding: '0.5rem 0.75rem', borderRadius: '12px', background: msg.username === username ? 'var(--primary)' : 'var(--bg-secondary)', color: msg.username === username ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.7, marginBottom: '2px' }}>{msg.username}</div>
              <div style={{ fontSize: '0.85rem' }}>{msg.message}</div>
              <div style={{ fontSize: '0.6rem', textAlign: 'right', marginTop: '2px', opacity: 0.6 }}>{msg.timestamp}</div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="input"
          style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 0.75rem' }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
