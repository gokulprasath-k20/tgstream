'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { 
  MessageSquare, Users, Info, MoreVertical, 
  Settings, Copy, CheckCircle
} from 'lucide-react';

export default function Room() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(null); 
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(res => res.json()).then(data => {
        if (!data.user) { router.push('/login'); return; }
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
  }, [roomId, router]);

  if (!user || !socket) return <div className="theme-container items-center justify-center"><p className="text-gray-500 animate-pulse">Entering room...</p></div>;

  return (
    <div className="theme-container">
      {/* 1. Top Section (Content + Participants + Sidebar) */}
      <div className="main-wrapper">
        
        {/* CENTER: The Stage (Always Clean) */}
        <div className="media-stage">
          <VideoPlayer 
            socket={socket} roomId={roomId} isHost={true} 
            localScreenStream={localScreenStream} setLocalScreenStream={setLocalScreenStream} 
            remoteScreenStream={remoteScreenStream} 
          />
        </div>

        {/* RIGHT: Combined Strip or Panel */}
        {activeTab ? (
          <div className="side-panel">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <h2 className="font-bold text-sm uppercase tracking-widest">{activeTab}</h2>
              <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-white/10 rounded-full"><Settings size={18} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
              {activeTab === 'people' && (
                <div className="p-4 space-y-4 overflow-y-auto h-full">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">{user.username[0]}</div>
                    <span className="text-sm font-medium">{user.username} (You)</span>
                  </div>
                  {roomUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2">
                       <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center font-bold">{u.username[0]}</div>
                       <span className="text-sm">{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Participant Strip when sidebar is closed */
          <div className="participant-strip">
             <VideoCall 
                socket={socket} roomId={roomId} username={user.username} 
                localScreenStream={localScreenStream} 
                onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)}
                isStripMode={true}
             />
          </div>
        )}
      </div>

      {/* 2. Bottom Toolbar (Fixed, Clean, Effective) */}
      <div className="bottom-bar">
        <div className="w-[300px] flex items-center gap-3">
          <p className="text-sm font-semibold opacity-70">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {roomId}</p>
          <button onClick={() => { navigator.clipboard.writeText(roomId); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="p-2 hover:bg-white/10 rounded-full">
            {copied ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>

        <div className="bar-center">
            {/* The VideoCall Component also provides the controls */}
            <VideoCall 
              socket={socket} roomId={roomId} username={user.username} 
              localScreenStream={localScreenStream} 
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)}
              isControlMode={true}
            />
        </div>

        <div className="w-[300px] flex justify-end gap-2">
          <button onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')} className={`circle-btn ${activeTab === 'people' ? 'bg-blue-600' : ''}`}><Users size={20} /></button>
          <button onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')} className={`circle-btn ${activeTab === 'chat' ? 'bg-blue-600' : ''}`}><MessageSquare size={20} /></button>
          <button className="circle-btn"><Info size={20} /></button>
        </div>
      </div>
    </div>
  );
}
