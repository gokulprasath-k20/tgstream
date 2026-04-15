'use client';
import { useState, useRef, useEffect } from 'react';
import { Monitor, Link as LinkIcon, Volume2 } from 'lucide-react';

export default function VideoPlayer({ socket, roomId, isHost, localScreenStream, setLocalScreenStream, remoteScreenStream }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState('');
  const [audioBlocked, setAudioBlocked] = useState(false);
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
        // Lower resolution/fps = less bandwidth = less lag for remote viewer
        // 1280x720 @ max 15fps is ideal for screen content (text stays sharp at lower fps)
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { 
            frameRate: { ideal: 10, max: 15 },
            width:     { ideal: 1280, max: 1920 }, 
            height:    { ideal: 720,  max: 1080 }
          },
          audio: { 
            echoCancellation: false, 
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100,
            channelCount: 2
          }
        });

        // 'detail' = browser prioritises sharpness over motion (best for text/UI)
        stream.getVideoTracks().forEach(t => { t.contentHint = 'detail'; });

        setLocalScreenStream(stream);
        socket.emit('screen-share-status', { roomId, isSharing: true });
        stream.getVideoTracks()[0].onended = () => stopSharing();
      } catch (err) { 
        console.error('[Screen] getDisplayMedia error:', err); 
      }
    } else {
      stopSharing();
    }
  };

  const stopSharing = () => {
    if (localScreenStream) localScreenStream.getTracks().forEach(t => t.stop());
    setLocalScreenStream(null);
    socket.emit('screen-share-status', { roomId, isSharing: false });
  };

  // ── Video sync ────────────────────────────────────────────────────────────────
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

  // ── Bind stream to video element ─────────────────────────────────────────────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (localScreenStream) {
      // *** CRITICAL: Always mute when playing YOUR OWN screen capture ***
      // Without this, User1 hears the audio twice (system + video element)
      // and tab-audio captures the element output → feedback loop → stuck/distorted
      el.srcObject = localScreenStream;
      el.muted = true;
      el.play().catch(console.error);
      setAudioBlocked(false);

    } else if (remoteScreenStream) {
      el.srcObject = remoteScreenStream;
      el.muted = false;
      // Explicit play() needed for autoplay with audio
      el.play().catch(() => {
        // Browser blocked autoplay audio — mute and show "click to unmute"
        el.muted = true;
        el.play().catch(console.error);
        setAudioBlocked(true);
      });

    } else {
      el.srcObject = null;
      setAudioBlocked(false);
    }
  }, [localScreenStream, remoteScreenStream]);

  const handleUnmute = () => {
    const el = videoRef.current;
    if (el) {
      el.muted = false;
      setAudioBlocked(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#000]">
      {/* Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {activeUrl || hasStream ? (
          <>
            <video 
              ref={videoRef} 
              src={hasStream ? undefined : activeUrl} 
              className="w-full h-full" 
              autoPlay 
              style={{ objectFit: 'contain' }}
              controls={isHost && !hasStream}
              onPlay={()   => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'play' })}
              onPause={()  => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'pause' })}
              onSeeked={()  => isHost && !hasStream && socket.emit('sync-video', { roomId, action: 'seek', time: videoRef.current.currentTime })}
            />

            {/* Click-to-unmute overlay for remote screen share audio */}
            {audioBlocked && remoteScreenStream && (
              <div className="absolute inset-0 flex items-end justify-center pb-8 pointer-events-none">
                <button
                  onClick={handleUnmute}
                  className="pointer-events-auto flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/20 text-white text-sm font-bold px-5 py-3 rounded-2xl hover:bg-white/10 transition-all animate-bounce"
                >
                  <Volume2 size={18} className="text-indigo-400" />
                  Click to enable audio
                </button>
              </div>
            )}

            {/* Screen share status badge */}
            {hasStream && (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {localScreenStream ? 'You are sharing (muted locally)' : 'Remote Screen Share'}
              </div>
            )}
          </>
        ) : (
          <div className="text-center opacity-40">
            <Monitor size={48} className="mx-auto mb-4" />
            <p className="text-sm font-medium">Ready to watch something amazing?</p>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="p-4 bg-[#111114] border-t border-white/5 flex gap-3">
        <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              className="w-full bg-white/5 border border-white/10 p-2.5 pl-4 rounded-lg text-sm outline-none focus:border-blue-500/50 transition-all" 
              placeholder="Paste movie link (mp4, webm)..." 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg text-sm font-bold transition-all">
            Load
          </button>
        </form>
        
        <button 
          onClick={toggleScreenShare} 
          className={`px-5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
            isSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          <Monitor size={18} />
          <span>{isSharing ? 'Stop Sharing' : 'Share Screen'}</span>
        </button>
      </div>
    </div>
  );
}
