'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { MessageSquare, Users, Video, Share2, Clipboard, CheckCircle } from 'lucide-react';

export default function Room() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('call'); // 'call', 'chat', 'users'
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    // 1. Check room privacy
    fetch(`/api/rooms?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.hasPassword) {
          setIsLocked(true);
        } else {
          setPasswordEntered(true);
        }
      });
  }, [roomId]);

  useEffect(() => {
    if (!passwordEntered) return;

    // 2. Fetch user auth status
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.user) {
          router.push('/login');
          return;
        }
        setUser(data.user);

        // 3. Initialize Socket connection
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        newSocket.emit('join-room', { roomId, username: data.user.username });

        newSocket.on('existing-users', (users) => {
          setRoomUsers(users);
        });

        newSocket.on('user-joined', ({ id, username }) => {
          setRoomUsers(prev => [...prev, { id, username }]);
        });

        newSocket.on('user-left', ({ id }) => {
          setRoomUsers(prev => prev.filter(u => u.id !== id));
        });

        newSocket.on('screen-share-changed', ({ isSharing, streamId, username }) => {
          if (!isSharing) {
            setRemoteScreenStream(null);
          }
        });

        return () => newSocket.close();
      });
  }, [roomId, router, passwordEntered]);

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setPassError('');
    const res = await fetch('/api/rooms/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, password: passwordInput }),
    });
    if (res.ok) {
      setPasswordEntered(true);
      setIsLocked(false);
    } else {
      setPassError('Invalid password');
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLocked && !passwordEntered) return (
    <div className="container flex justify-center items-center h-screen" style={{ marginTop: '-80px' }}>
      <div className="card w-full" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <Lock size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
        <h2>Private Room</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This party is password protected.</p>
        <form onSubmit={handleVerifyPassword} className="flex flex-col gap-3">
          <input 
            type="password" 
            className="input" 
            placeholder="Enter Password" 
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            required
            autoFocus
          />
          {passError && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{passError}</p>}
          <button type="submit" className="btn btn-primary w-full">Join Room</button>
        </form>
      </div>
    </div>
  );

  if (!user || !socket) return (
    <div className="container flex justify-center items-center h-screen" style={{ marginTop: '-80px' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 className="animate-pulse">Connecting to Room...</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Establishing secure connection</p>
      </div>
    </div>
  );

  return (
    <div className="flex" style={{ height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* 75% MAIN VIDEO AREA */}
      <div style={{ flex: '0 0 75%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border)' }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Room: <span style={{ color: 'var(--primary)' }}>{roomId}</span></h2>
            <button onClick={copyRoomId} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
              {copied ? <CheckCircle size={14} style={{ color: 'var(--success)' }} /> : <Clipboard size={14} />}
              {copied ? 'Copied' : 'Copy ID'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2" style={{ color: 'var(--success)', fontSize: '0.9rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }}></div>
              Connected as {user.username}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <VideoPlayer 
            socket={socket} 
            roomId={roomId} 
            isHost={true} 
            localScreenStream={localScreenStream}
            setLocalScreenStream={setLocalScreenStream}
            remoteScreenStream={remoteScreenStream}
          />
        </div>
      </div>

      {/* 25% SIDE PANEL (Video Call + Chat) */}
      <div style={{ flex: '0 0 25%', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
          {[
            { id: 'call', icon: <Video size={18} />, label: 'Call' },
            { id: 'chat', icon: <MessageSquare size={18} />, label: 'Chat' },
            { id: 'users', icon: <Users size={18} />, label: `Users (${roomUsers.length + 1})` }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 p-3 flex flex-col items-center justify-center gap-1"
              style={{ 
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : 'none',
                background: activeTab === tab.id ? 'rgba(99, 102, 241, 0.05)' : 'none',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.75rem'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: '1rem', overflow: 'hidden' }}>
          {activeTab === 'call' && (
            <VideoCall 
              socket={socket} 
              roomId={roomId} 
              username={user.username} 
              localScreenStream={localScreenStream}
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)}
            />
          )}
          {activeTab === 'chat' && (
            <Chat socket={socket} roomId={roomId} username={user.username} />
          )}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(99, 102, 241, 0.1)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user.username[0].toUpperCase()}
                </div>
                <span>{user.username} (You)</span>
              </div>
              {roomUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2">
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <span>{u.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


