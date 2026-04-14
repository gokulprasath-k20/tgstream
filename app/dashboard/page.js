'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogIn, Monitor, Copy, Check } from 'lucide-react';

export default function Dashboard() {
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user) router.push('/login');
        else setUser(data.user);
      });
  }, [router]);

  const handleCreateRoom = async () => {
    setCreateLoading(true);
    const newId = crypto.randomUUID().split('-')[0];
    
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: newId, password: roomPassword }),
      });

      if (res.ok) {
        router.push(`/room/${newId}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create room');
      }
    } catch (err) {
      alert('Connection error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  if (!user) return <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>Loading...</div>;

  return (
    <div className="container" style={{ padding: '60px 0' }}>
      <header style={{ marginBottom: '3rem' }}>
        <h1 className="title">Welcome, {user.username}</h1>
        <p className="subtitle">Start a new party or join an existing one.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Create Room */}
        <div className="card flex flex-col items-center justify-center gap-4" style={{ minHeight: '350px' }}>
          <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', color: 'var(--primary)' }}>
            <Plus size={32} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3>Create a New Room</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Add an optional password for privacy.
            </p>
          </div>
          <input 
            type="password" 
            className="input" 
            placeholder="Room Password (Optional)" 
            value={roomPassword}
            onChange={(e) => setRoomPassword(e.target.value)}
          />
          <button onClick={handleCreateRoom} className="btn btn-primary w-full" disabled={createLoading}>
            <Monitor size={20} />
            {createLoading ? 'Creating...' : 'Create Room'}
          </button>
        </div>

        {/* Join Room */}
        <div className="card flex flex-col items-center justify-center gap-4" style={{ minHeight: '350px' }}>
          <div style={{ padding: '1rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '50%', color: 'var(--accent)' }}>
            <LogIn size={32} />
          </div>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <h3>Join Existing Room</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Enter the Room ID shared by your friend.
            </p>
          </div>
          <form onSubmit={handleJoinRoom} className="w-full flex flex-col gap-3">
            <input 
              type="text" 
              className="input" 
              placeholder="Enter Room ID" 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-secondary w-full">
              Join Party
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

