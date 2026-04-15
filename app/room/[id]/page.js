'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import io from 'socket.io-client';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCall from '@/components/VideoCall';
import Chat from '@/components/Chat';
import { 
  MessageSquare, Users, MoreVertical, 
  Settings, Copy, CheckCircle,
  Mic, MicOff, Video, VideoOff, PhoneOff
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
  
  // Media States — controlled directly here, passed as props to VideoCall
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

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

  const handleLeave = () => {
    if (socket) socket.close();
    router.push('/dashboard');
  };

  const copyMeetingId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user || !socket) return (
    <div className="min-h-screen bg-[#05060f] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Entering room...</p>
    </div>
  );

  return (
    <div className="theme-container">
      {/* 1. Main Viewport */}
      <div className="main-wrapper">
        
        {/* LEFT: Stage */}
        <div className="media-stage">
          <VideoPlayer 
            socket={socket} 
            roomId={roomId} 
            isHost={true} 
            localScreenStream={localScreenStream} 
            setLocalScreenStream={setLocalScreenStream} 
            remoteScreenStream={remoteScreenStream} 
          />
        </div>

        {/* RIGHT: Video Strip + Optional Panel */}
        <div className="flex">
          <div className="participant-strip">
            <VideoCall 
              socket={socket} 
              roomId={roomId} 
              username={user.username} 
              localScreenStream={localScreenStream} 
              onRemoteScreenStream={(stream) => setRemoteScreenStream(stream)}
              isStripMode={true}
              muted={muted}
              videoOff={videoOff}
            />
          </div>

          {activeTab && (
            <div className="side-panel">
              <div className="p-4 flex items-center justify-between border-b border-white/10">
                <h2 className="font-bold text-xs uppercase tracking-widest text-gray-400">{activeTab}</h2>
                <button onClick={() => setActiveTab(null)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {activeTab === 'chat' && <Chat socket={socket} roomId={roomId} username={user.username} />}
                {activeTab === 'people' && (
                  <div className="p-4 space-y-2 overflow-y-auto h-full text-sm">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-600/10 border border-indigo-500/20 font-medium">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span>{user.username} <span className="text-indigo-400 text-xs">(You)</span></span>
                    </div>
                    {roomUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-3 text-gray-300 rounded-xl hover:bg-white/5 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                          {u.username[0].toUpperCase()}
                        </div>
                        <span>{u.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Bottom Toolbar */}
      <div className="bottom-bar">
        {/* Meeting ID */}
        <div className="w-[280px] flex items-center">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Meeting ID</p>
              <p className="text-sm font-bold font-mono text-white truncate">{roomId}</p>
            </div>
            <button 
              onClick={copyMeetingId}
              className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Copy Meeting ID"
            >
              {copied 
                ? <CheckCircle size={15} className="text-green-400" /> 
                : <Copy size={15} />
              }
            </button>
          </div>
        </div>

        {/* Media Controls */}
        <div className="bar-center gap-3">
          <button
            onClick={() => setMuted(prev => !prev)}
            className={`circle-btn ${muted ? 'danger' : ''}`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={() => setVideoOff(prev => !prev)}
            className={`circle-btn ${videoOff ? 'danger' : ''}`}
            title={videoOff ? 'Show Video' : 'Hide Video'}
          >
            {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button 
            onClick={handleLeave} 
            className="circle-btn danger"
            title="Leave Room"
          >
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Panel Toggles */}
        <div className="w-[280px] flex justify-end gap-2">
          <button 
            onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')} 
            className={`circle-btn ${activeTab === 'people' ? 'bg-indigo-600 border-indigo-500 text-white' : ''}`}
            title="Participants"
          >
            <Users size={20} />
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')} 
            className={`circle-btn ${activeTab === 'chat' ? 'bg-indigo-600 border-indigo-500 text-white' : ''}`}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>
          <button className="circle-btn" title="Settings">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
