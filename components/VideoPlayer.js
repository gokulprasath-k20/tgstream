'use client';
import { useState, useRef, useEffect } from 'react';
import { Monitor, Link as LinkIcon } from 'lucide-react';

export default function VideoPlayer({ socket, roomId, isHost, localScreenStream, setLocalScreenStream, remoteScreenStream }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const videoRef = useRef(null);

  const isSharing = !!localScreenStream;
  const hasStream = localScreenStream || remoteScreenStream;

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      setActiveUrl(videoUrl);
      socket.emit('sync-video', { roomId, action: 'load', url: videoUrl });
    }
  };

  const toggleScreenShare = async () => {
    if (!isSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setLocalScreenStream(stream);
        socket.emit('screen-share-status', { roomId, isSharing: true });
        stream.getVideoTracks()[0].onended = () => stopSharing();
      } catch (err) { console.error(err); }
    } else stopSharing();
  };

  const stopSharing = () => {
    if (localScreenStream) localScreenStream.getTracks().forEach(track => track.stop());
    setLocalScreenStream(null);
    socket.emit('screen-share-status', { roomId, isSharing: false });
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('video-sync', ({ action, url, time }) => {
      if (action === 'load') setActiveUrl(url);
      if (videoRef.current && !hasStream) {
        if (action === 'play') videoRef.current.play();
        if (action === 'pause') videoRef.current.pause();
        if (action === 'seek') videoRef.current.currentTime = time;
      }
    });
    return () => socket.off('video-sync');
  }, [socket, hasStream]);

  useEffect(() => {
    if (videoRef.current && hasStream) {
      videoRef.current.srcObject = localScreenStream || remoteScreenStream;
    }
  }, [localScreenStream, remoteScreenStream, hasStream]);

  return (
    <div className="flex flex-col h-full bg-[#000]">
      {/* 1. Main Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {activeUrl || hasStream ? (
          <video 
            ref={videoRef} 
            src={hasStream ? undefined : activeUrl} 
            className="w-full h-full" 
            autoPlay 
            style={{ objectFit: 'contain' }}
            controls={isHost && !hasStream}
            onPlay={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'play' })}
            onPause={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'pause' })}
            onSeeked={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'seek', time: videoRef.current.currentTime })}
          />
        ) : (
          <div className="text-center opacity-40">
            <Monitor size={48} className="mx-auto mb-4" />
            <p className="text-sm font-medium">Ready to watch something amazing?</p>
          </div>
        )}
      </div>

      {/* 2. Control Input Area */}
      <div className="p-4 bg-[#111114] border-t border-white/5 flex gap-3">
        <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input 
              type="text" 
              className="w-full bg-white/5 border border-white/10 p-2.5 pl-10 rounded-lg text-sm outline-none focus:border-blue-500/50 transition-all" 
              placeholder="Paste movie link (mp4, webm)..." 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg text-sm font-bold transition-all">Load</button>
        </form>
        
        <button 
          onClick={toggleScreenShare} 
          className={`px-5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isSharing ? 'bg-red-600' : 'bg-gray-800'}`}
        >
          <Monitor size={18} />
          <span>{isSharing ? 'Stop' : 'Share Screen'}</span>
        </button>
      </div>
    </div>
  );
}
