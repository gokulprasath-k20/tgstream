'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, MoreVertical } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef();
  const pcsRef = useRef({}); // { socketId: RTCPeerConnection }

  // 1. Initialize Local Camera
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // CRITICAL: Signal to the room that we are ready for WebRTC
        socket.emit('ready-for-handshake');
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    init();

    return () => {
      if (localStream) localStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 2. Peer Connection Factory
  const createPC = (targetId, stream, targetName) => {
    if (pcsRef.current[targetId]) return pcsRef.current[targetId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        ...(process.env.NEXT_PUBLIC_TURN_USERNAME ? [
          {
            urls: "turn:global.relay.metered.ca:80",
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_PASSWORD
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_PASSWORD
          }
        ] : [])
      ]
    });

    pcsRef.current[targetId] = pc;

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { targetId, signal: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      setRemoteStreams(prev => {
        if (prev.find(p => p.id === targetId)) return prev;
        return [...prev, { id: targetId, stream: remoteStream, username: targetName || 'User' }];
      });
    };

    return pc;
  };

  // 3. Signaling Handshake
  useEffect(() => {
    if (!socket || !localStream) return;

    // When a NEW user signals they are ready, we (the existing user) send an Offer
    socket.on('initiate-call', ({ id, username: name }) => {
      console.log(`[WebRTC] Initiating call to: ${name}`);
      const pc = createPC(id, localStream, name);
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socket.emit('signal', { targetId: id, signal: offer });
      });
    });

    socket.on('signal', async ({ senderId, signal }) => {
      let pc = pcsRef.current[senderId];
      if (!pc) pc = createPC(senderId, localStream);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { targetId: senderId, signal: answer });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    });

    socket.on('user-left', ({ id }) => {
      if (pcsRef.current[id]) {
        pcsRef.current[id].close();
        delete pcsRef.current[id];
      }
      setRemoteStreams(prev => prev.filter(p => p.id !== id));
    });

    return () => {
      socket.off('initiate-call');
      socket.off('signal');
      socket.off('user-left');
    };
  }, [socket, localStream]);

  const toggleMute = () => {
    localStream.getAudioTracks()[0].enabled = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    localStream.getVideoTracks()[0].enabled = !isVideoOff;
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="flex flex-col h-full gap-4" style={{ color: 'var(--text)' }}>
      {/* Scrollable Video Area */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
        {/* Self View */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', background: '#000' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full" 
            style={{ minHeight: '160px', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>
            You {isMuted && ' (Muted)'}
          </div>
        </div>

        {/* Remote Views */}
        {remoteStreams.map(peer => (
          <div key={peer.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)', background: '#000' }}>
            <video 
              autoPlay 
              playsInline 
              className="w-full h-full" 
              style={{ minHeight: '160px', objectFit: 'cover' }}
              ref={el => { if (el) el.srcObject = peer.stream; }}
              onClick={(e) => e.target.play()}
            />
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {peer.username}
              {process.env.NEXT_PUBLIC_TURN_USERNAME && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />}
            </div>
            
            {/* Fail-safe play trigger for mobile browser restrictions */}
            <div 
              onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()}
              style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.01)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.6rem', color: '#ccc', opacity: 0.5 }}>Tap to fix video</span>
            </div>
          </div>
        ))}

        {remoteStreams.length === 0 && (
          <div className="card text-center" style={{ padding: '2rem', borderStyle: 'dashed' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for others to join call...</p>
          </div>
        )}
      </div>

      {/* Basic Controls */}
      <div className="flex justify-center items-center gap-3 p-3" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <button 
          onClick={toggleMute}
          className="btn" 
          style={{ 
            background: isMuted ? 'var(--error)' : 'var(--bg)', 
            color: isMuted ? '#fff' : 'var(--text)', 
            border: '1px solid var(--border)',
            padding: '10px',
            borderRadius: '50%'
          }}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button 
          onClick={toggleVideo}
          className="btn"
          style={{ 
            background: isVideoOff ? 'var(--error)' : 'var(--bg)', 
            color: isVideoOff ? '#fff' : 'var(--text)', 
            border: '1px solid var(--border)',
            padding: '10px',
            borderRadius: '50%'
          }}
        >
          {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="btn btn-error"
          style={{ padding: '10px', borderRadius: '50%' }}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
