'use client';
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Maximize, Monitor, Link as LinkIcon, X } from 'lucide-react';

export default function VideoPlayer({ socket, roomId, isHost, localScreenStream, setLocalScreenStream, remoteScreenStream }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const videoRef = useRef(null);

  const isSharing = !!localScreenStream;

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
        
        stream.getVideoTracks()[0].onended = () => {
          stopSharing();
        };
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    } else {
      stopSharing();
    }
  };

  const stopSharing = () => {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => track.stop());
    }
    setLocalScreenStream(null);
    socket.emit('screen-share-status', { roomId, isSharing: false });
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('video-sync', ({ action, url, time }) => {
      if (action === 'load') setActiveUrl(url);
      if (videoRef.current && !isSharing && !remoteScreenStream) {
        if (action === 'play') videoRef.current.play();
        if (action === 'pause') videoRef.current.pause();
        if (action === 'seek') videoRef.current.currentTime = time;
      }
    });

    return () => socket.off('video-sync');
  }, [socket, isSharing, remoteScreenStream]);

  // Handle stream assignment to video element
  useEffect(() => {
    if (videoRef.current) {
      if (localScreenStream) {
        videoRef.current.srcObject = localScreenStream;
      } else if (remoteScreenStream) {
        videoRef.current.srcObject = remoteScreenStream;
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [localScreenStream, remoteScreenStream]);

  const hasStream = localScreenStream || remoteScreenStream;

  return (
    <div className="card h-full flex flex-col gap-4" style={{ padding: '0', overflow: 'hidden', background: '#000' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {activeUrl || hasStream ? (
          <video 
            ref={videoRef} 
            src={hasStream ? undefined : activeUrl} 
            className="w-full h-full" 
            autoPlay 
            controls={isHost && !hasStream}
            onPlay={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'play' })}
            onPause={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'pause' })}
            onSeeked={() => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'seek', time: videoRef.current.currentTime })}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <Monitor size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Waiting for movie or screen share...</p>
          </div>
        )}
      </div>

      <div className="glass" style={{ padding: '1rem', display: 'flex', gap: '1rem', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <LinkIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Paste video URL (mp4, webm)" 
              style={{ paddingLeft: '2.5rem' }}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">Load</button>
        </form>
        
        <button 
          onClick={toggleScreenShare} 
          className={`btn ${isSharing ? 'btn-secondary' : 'btn-primary'}`}
          style={{ background: isSharing ? 'var(--error)' : undefined }}
        >
          <Monitor size={20} />
          {isSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>
      </div>
    </div>
  );
}

