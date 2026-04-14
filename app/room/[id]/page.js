'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { 
  MessageSquare, Users, Info, MoreVertical, 
  Hand, ClosedCaption, Grid, Settings
} from 'lucide-react';

export default function Room() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(null); // 'chat' or 'people'
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [roomUsers, setRoomUsers] = useState([]);
  const [passwordEntered, setPasswordEntered] = useState(false);

  useEffect(() => {
    fetch(`/api/rooms?roomId=${roomId}`)
      .then(res => res.json())
      .then(data => {
        if (!data.hasPassword) setPasswordEntered(true);
      });
  }, [roomId]);

  useEffect(() => {
    if (!passwordEntered) return;

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
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

  if (!user || !socket) return <div className="gmeet-container items-center justify-center"><p className="animate-pulse opacity-50 text-sm">Joining meeting...</p></div>;

  return (
    <div className="gmeet-container">
      {/* 1. Main Content Area */}
      <div className="gmeet-main">
        
        {/* Central Stage: Movie or Screen Share */}
        <div className="gmeet-video-area">
          <VideoPlayer 
            socket={socket} 
            roomId={roomId} 
            isHost={true} 
            localScreenStream={localScreenStream} 
            setLocalScreenStream={setLocalScreenStream} 
            remoteScreenStream={remoteScreenStream} 
          />
        </div>

        {/* Dynamic Sidebar for Chat/Participants OR Floating Grid */}
        {activeTab ? (
          <div className="gmeet-sidebar animate-fade-in">
            <div className="p-5 flex justify-between items-center border-b dark:border-gray-800">
              <h2 className="text-lg font-medium capitalize">{activeTab}</h2>
              <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <MoreVertical size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
              {activeTab === 'people' && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{user.username[0]}</div>
                    <span className="font-medium text-sm">{user.username} (You)</span>
                  </div>
                  {roomUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-500 text-white flex items-center justify-center font-bold">{u.username[0]}</div>
                      <span className="text-sm font-medium">{u.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 2. Authentic GMeet Bottom Toolbar */}
      <div className="gmeet-toolbar">
        
        {/* Left: Time & Meeting Code */}
        <div className="toolbar-left">
          <p className="text-sm font-medium">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {roomId}
          </p>
        </div>

        {/* Center: The Call Control Center */}
        <div className="toolbar-center">
            <VideoCall 
              socket={socket} 
              roomId={roomId} 
              username={user.username} 
              localScreenStream={localScreenStream} 
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)} 
              isGMeetClassic={true}
            />
            
            {/* Additional GMeet Mock Buttons for Visual Match */}
            <button className="control-btn"><ClosedCaption size={20} /></button>
            <button className="control-btn"><Hand size={20} /></button>
            <button className="control-btn"><Grid size={20} /></button>
        </div>

        {/* Right: Info & Tab Toggles */}
        <div className="toolbar-right">
          <button className="p-3 hover:bg-gray-800 rounded-full text-white opacity-70"><Info size={20} /></button>
          <button 
            onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}
            className={`p-3 rounded-full ${activeTab === 'people' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-800 text-white opacity-70'}`}
          >
            <Users size={20} />
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
            className={`p-3 rounded-full ${activeTab === 'chat' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-800 text-white opacity-70'}`}
          >
            <MessageSquare size={20} />
          </button>
          <button className="p-3 hover:bg-gray-800 rounded-full text-white opacity-70"><Settings size={20} /></button>
        </div>
      </div>
    </div>
  );
}
