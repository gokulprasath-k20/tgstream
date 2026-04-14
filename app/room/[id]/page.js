'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { 
  MessageSquare, Users, Info, MoreVertical, 
  Hand, ClosedCaption, Grid, Settings, Share2
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
  const [passwordEntered, setPasswordEntered] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => { if (!data.hasPassword) setPasswordEntered(true); });
  }, [roomId]);

  useEffect(() => {
    if (!passwordEntered) return;
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
  }, [roomId, router, passwordEntered]);

  if (!user || !socket) return <div className="gmeet-container items-center justify-center bg-[#05060f]"><div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="gmeet-container">
      {/* 1. Main Viewport */}
      <div className="gmeet-main animate-slide-up">
        
        {/* The Glow-Border Main Stage */}
        <div className="gmeet-video-area group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <VideoPlayer 
            socket={socket} 
            roomId={roomId} 
            isHost={true} 
            localScreenStream={localScreenStream} 
            setLocalScreenStream={setLocalScreenStream} 
            remoteScreenStream={remoteScreenStream} 
          />
        </div>

        {/* The Glass Sidebar */}
        {activeTab && (
          <div className="gmeet-sidebar glass m-0 animate-slide-up w-[380px] rounded-[24px] border-white/5">
            <div className="p-6 flex justify-between items-center border-b border-white/5">
              <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent capitalize">{activeTab}</h2>
              <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
                <Settings size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
              {activeTab === 'people' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">{user.username[0]}</div>
                    <div>
                      <p className="font-bold text-sm">{user.username}</p>
                      <p className="text-xs text-indigo-400">Host • You</p>
                    </div>
                  </div>
                  {roomUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-4 p-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-800 text-white flex items-center justify-center font-bold">{u.username[0]}</div>
                      <span className="text-sm font-semibold text-gray-300">{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. The Premium Toolbar */}
      <div className="gmeet-toolbar">
        <div className="toolbar-left">
          <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm font-bold tracking-tight">{roomId}</p>
          </div>
        </div>

        <div className="toolbar-center">
            <VideoCall 
              socket={socket} 
              roomId={roomId} 
              username={user.username} 
              localScreenStream={localScreenStream} 
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)} 
              isWowMode={true}
            />
            {/* Action Group */}
            <div className="w-[1px] h-8 bg-white/10 mx-2" />
            <div className="flex gap-2">
              <button className="control-btn"><Hand size={20} /></button>
              <button className="control-btn"><Share2 size={20} /></button>
            </div>
        </div>

        <div className="toolbar-right gap-3">
          <button 
            onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}
            className={`control-btn ${activeTab === 'people' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : ''}`}
          >
            <Users size={20} />
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`control-btn ${activeTab === 'chat' ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : ''}`}
          >
            <MessageSquare size={20} />
          </button>
          <button className="control-btn"><Info size={20} /></button>
        </div>
      </div>
    </div>
  );
}
