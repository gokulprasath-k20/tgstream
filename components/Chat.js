'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, User } from 'lucide-react';

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

      // Real-time
      socket.emit('send-message', msgData);

      // Persistence
      try {
        await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, message: message.trim(), timestamp }),
        });
      } catch (err) {
        console.error('Failed to save message');
      }

      setMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full glass" style={{ borderRadius: '1rem', overflow: 'hidden' }}>
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Live Chat</h3>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ 
            alignSelf: msg.username === username ? 'flex-end' : 'flex-start',
            maxWidth: '80%'
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: msg.username === username ? 'flex-end' : 'flex-start' 
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                {msg.username} • {msg.timestamp}
              </span>
              <div style={{ 
                padding: '0.6rem 1rem', 
                borderRadius: msg.username === username ? '1rem 0 1rem 1rem' : '0 1rem 1rem 1rem',
                background: msg.username === username ? 'var(--primary)' : 'var(--secondary)',
                fontSize: '0.9rem',
                lineHeight: '1.4'
              }}>
                {msg.message}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="input"
          style={{ padding: '0.5rem 1rem' }}
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
