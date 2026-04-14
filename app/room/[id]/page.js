'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { MessageSquare, Users, Video, Clipboard, CheckCircle, Lock } from 'lucide-react';

export default function Room() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('call');
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    fetch(`/api/rooms?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.hasPassword) setIsLocked(true);
        else setPasswordEntered(true);
      });
  }, [roomId]);

  useEffect(() => {
    if (!passwordEntered) return;

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        setUser(data.user);

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const newSocket = io(socketUrl, {
          transports: ['websocket'],
          reconnectionAttempts: 5,
        });
        setSocket(newSocket);

        newSocket.emit('join-room', { roomId, username: data.user.username });

        newSocket.on('existing-users', (users) => setRoomUsers(users));
        newSocket.on('user-joined', ({ id, username }) => setRoomUsers(prev => [...prev, { id, username }]));
        newSocket.on('user-left', ({ id }) => setRoomUsers(prev => prev.filter(u => u.id !== id)));
        
        return () => newSocket.close();
      });
  }, [roomId, router, passwordEntered]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/rooms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, password: passwordInput }),
    });
    if (res.ok) {
      setPasswordEntered(true);
      setIsLocked(false);
    } else setPassError('Invalid password');
  };

  if (isLocked && !passwordEntered) return (
    <div className="container flex justify-center items-center" style={{ minHeight: '80vh' }}>
      <div className="card w-full" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <Lock size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', margin: '0 auto' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Private Room</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Enter password to join the party.</p>
        <form onSubmit={handleVerifyPassword} className="flex flex-col gap-3">
          <input type="password" className="input" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
          {passError && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{passError}</p>}
          <button type="submit" className="btn btn-primary w-full">Join Now</button>
        </form>
      </div>
    </div>
  );

  if (!user || !socket) return (
    <div className="container flex justify-center items-center" style={{ minHeight: '80vh' }}>
      <h2 className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Entering Room...</h2>
    </div>
  );

  return (
    <div className="container" style={{ paddingBottom: '2rem' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
            {roomId}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Share this ID with friends</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="btn btn-secondary">
            {copied ? <CheckCircle size={16} /> : <Clipboard size={16} />}
            <span>{copied ? 'Copied' : 'Copy ID'}</span>
          </button>
        </div>
      </div>

      <div className="room-layout">
        <div className="flex flex-col gap-4">
          <VideoPlayer socket={socket} roomId={roomId} isHost={true} localScreenStream={localScreenStream} setLocalScreenStream={setLocalScreenStream} remoteScreenStream={remoteScreenStream} />
        </div>

        <div className="sidebar-container">
          <div className="flex p-1 gap-1" style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'call', icon: <Video size={16} />, label: 'Call' },
              { id: 'chat', icon: <MessageSquare size={16} />, label: 'Chat' },
              { id: 'users', icon: <Users size={16} />, label: `Users (${roomUsers.length + 1})` }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 p-2 rounded-lg flex items-center justify-center gap-2"
                style={{ 
                  background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
            {activeTab === 'call' && (
              <VideoCall socket={socket} roomId={roomId} username={user.username} localScreenStream={localScreenStream} onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)} />
            )}
            {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
            {activeTab === 'users' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{user.username[0].toUpperCase()}</div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.username} (You)</span>
                </div>
                {roomUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{u.username[0].toUpperCase()}</div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{u.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
