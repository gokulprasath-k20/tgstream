'use client';
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Maximize, Monitor, Link as LinkIcon, X } from 'lucide-react';

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
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
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
    <div className="card h-full flex flex-col gap-4" style={{ padding: '0', overflow: 'hidden', minHeight: '400px', background: '#000' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <Monitor size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Waiting for content...</p>
          </div>
        )}
      </div>

      <div style={{ padding: '1rem', display: 'flex', gap: '0.75rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleUrlSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <LinkIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Paste movie URL..." 
              style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0 1.25rem' }}>Load</button>
        </form>
        
        <button 
          onClick={toggleScreenShare} 
          className={isSharing ? 'btn btn-error' : 'btn btn-secondary'}
          style={{ padding: '0 1.25rem' }}
        >
          <Monitor size={18} />
          <span style={{ fontSize: '0.85rem' }}>{isSharing ? 'Stop' : 'Share'}</span>
        </button>
      </div>
    </div>
  );
}
