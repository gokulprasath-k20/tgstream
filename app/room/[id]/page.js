'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { 
  MessageSquare, Users, Video, Clipboard, CheckCircle, 
  Lock, Info, MoreVertical, ShieldAlert
} from 'lucide-react';

export default function Room() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // 'chat' or 'people' or null
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [passwordEntered, setPasswordEntered] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // 1. Password Protection Logic
  useEffect(() => {
    fetch(`/api/rooms?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (data.hasPassword) setIsLocked(true);
        else setPasswordEntered(true);
      });
  }, [roomId]);

  // 2. Main Logic Initialization
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
        const newSocket = io(socketUrl, { transports: ['websocket'] });
        setSocket(newSocket);

        newSocket.emit('join-room', { roomId, username: data.user.username });
        newSocket.on('existing-users', (users) => setRoomUsers(users));
        newSocket.on('user-joined', ({ id, username }) => setRoomUsers(prev => [...prev, { id, username }]));
        newSocket.on('user-left', ({ id }) => setRoomUsers(prev => prev.filter(u => u.id !== id)));
        
        return () => newSocket.close();
      });
  }, [roomId, router, passwordEntered]);

  const toggleTab = (tab) => setActiveTab(activeTab === tab ? null : tab);

  if (isLocked && !passwordEntered) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-[#0f172a]">
      <div className="card w-full max-w-sm text-center p-8">
        <ShieldAlert size={48} className="mx-auto text-blue-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Private Meeting</h2>
        <p className="text-gray-500 text-sm mb-6">Enter the room password to join the party.</p>
        <form onSubmit={(e) => {
          e.preventDefault();
          fetch('/api/rooms/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, password: passwordInput }),
          }).then(res => res.ok ? setPasswordEntered(true) : alert('Wrong Password'));
        }} className="space-y-4">
          <input type="password" placeholder="Password" className="input" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} required />
          <button type="submit" className="btn btn-primary w-full py-3">Join Meeting</button>
        </form>
      </div>
    </div>
  );

  if (!user || !socket) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-[#0f172a]">
      <div className="text-center">
        <div className="flex gap-1 justify-center mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
        <p className="text-sm font-medium text-gray-400">Joining room {roomId}...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a]">
      {/* 1. Main Viewport (Video / Movie Area) */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* The "Center Stage" */}
        <div className="flex-1 flex flex-col p-4 space-y-4">
          <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-2xl relative">
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

        {/* The Sidebar (Google Meet Style) */}
        {activeTab && (
          <div className="w-[360px] bg-white dark:bg-[#1e293b] border-l dark:border-gray-800 flex flex-col m-4 rounded-xl shadow-xl overflow-hidden transition-all duration-300">
            <div className="p-4 flex justify-between items-center border-bottom dark:border-gray-800">
              <h2 className="text-lg font-semibold capitalize">{activeTab} Details</h2>
              <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                <MoreVertical size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
              {activeTab === 'people' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-4">In attendance</p>
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">{user.username[0]}</div>
                    <span className="font-medium text-sm">{user.username} (You)</span>
                  </div>
                  {roomUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold">{u.username[0]}</div>
                      <span className="text-sm font-medium">{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Bottom Toolbar (Classic GMeet Style) */}
      <div className="h-[80px] bg-white dark:bg-[#0f172a] border-t dark:border-gray-800 flex items-center justify-between px-6 z-50">
        
        {/* Left: Meeting Info */}
        <div className="flex items-center gap-4 w-[250px]">
          <div className="hidden sm:block">
            <p className="text-sm font-semibold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {roomId}</p>
          </div>
          <button 
            onClick={() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000); }} 
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all text-gray-500"
          >
            {copied ? <CheckCircle className="text-green-500" size={20} /> : <Info size={20} />}
          </button>
        </div>

        {/* Center: Essential Controls (Injected into VideoCall component) */}
        <div className="flex-1 flex justify-center">
            <VideoCall 
              socket={socket} 
              roomId={roomId} 
              username={user.username} 
              localScreenStream={localScreenStream} 
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)} 
              isGMeetMode={true}
            />
        </div>

        {/* Right: Feature Toggles */}
        <div className="flex items-center justify-end gap-2 w-[250px]">
          <button 
            onClick={() => toggleTab('people')}
            className={`p-4 rounded-full transition-all ${activeTab === 'people' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
            <Users size={20} />
          </button>
          <button 
            onClick={() => toggleTab('chat')}
            className={`p-4 rounded-full transition-all ${activeTab === 'chat' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
            <MessageSquare size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
