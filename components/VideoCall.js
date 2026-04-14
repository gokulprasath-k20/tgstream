'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef();
  const pcsRef = useRef({}); // { socketId: RTCPeerConnection }
  const screenSendersRef = useRef({}); // { socketId: [RTCRtpSender] }

  // 1. Initialize Local Camera
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }, 
          audio: true 
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        
        // Wait a tiny bit for the OS to lock the camera, then signal
        setTimeout(() => {
          socket.emit('ready-for-handshake');
        }, 500);
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    init();
    return () => { if (localStream) localStream.getTracks().forEach(t => t.stop()); };
  }, []);

  // 2. Peer Connection Factory
  const createPC = (targetId, stream, targetName) => {
    if (pcsRef.current[targetId]) return pcsRef.current[targetId];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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

    // Add Video/Audio Tracks with IDs to differentiate
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // Add Screen Share Tracks
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(track => {
        pc.addTrack(track, localScreenStream);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { targetId, signal: { candidate: e.candidate } });
      }
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      console.log("[WebRTC] Track received:", e.track.kind);

      // Handle Screen Share specifically (if it's a second stream)
      if (e.streams.length > 1 || (e.track.kind === 'video' && e.streams[0].id.includes('screen'))) {
        onRemoteScreenStream(e.streams[1] || e.streams[0]);
      } else {
        setRemoteStreams(prev => {
          if (prev.find(p => p.id === targetId)) return prev;
          return [...prev, { id: targetId, stream: remoteStream, username: targetName || 'User' }];
        });
      }
    };

    return pc;
  };

  // 3. Perfect Negotiation Signaling
  useEffect(() => {
    if (!socket || !localStream) return;

    // A existing user sees a "ready" signal and sends an Offer
    socket.on('initiate-call', async ({ id, username: name }) => {
      const pc = createPC(id, localStream, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId: id, signal: offer });
    });

    socket.on('signal', async ({ senderId, signal }) => {
      let pc = pcsRef.current[senderId];
      if (!pc) pc = createPC(senderId, localStream);

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { targetId: senderId, signal: answer });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.warn("[WebRTC] Signal handling error:", err);
      }
    });

    return () => {
      socket.off('initiate-call');
      socket.off('signal');
    };
  }, [socket, localStream]);

  // Handle Screen Share Toggles
  useEffect(() => {
    if (!localScreenStream) return;
    
    // Notify others that we are sharing screen and re-negotiate
    Object.keys(pcsRef.current).forEach(async (id) => {
      const pc = pcsRef.current[id];
      if (pc) {
        localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { targetId: id, signal: offer });
      }
    });
  }, [localScreenStream]);

  const toggleMute = () => { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); };
  const toggleVideo = () => { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#000' }}>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full" style={{ minHeight: '160px', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>You {isMuted && '🔇'}</div>
        </div>

        {remoteStreams.map(peer => (
          <div key={peer.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#000' }}>
            <video autoPlay playsInline className="w-full" style={{ minHeight: '160px', objectFit: 'cover' }} ref={el => { if (el) el.srcObject = peer.stream; }} />
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.1)', color: '#fff', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '10px' }}>
              {peer.username}
            </div>
            {/* Overlay to ensure audio starts on touch */}
            <div onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} />
          </div>
        ))}
      </div>

      <div className="flex justify-center items-center gap-3 p-3 bg-secondary rounded-xl border border-border mt-auto">
        <button onClick={toggleMute} className="btn" style={{ background: isMuted ? 'var(--error)' : 'var(--bg-card)', color: isMuted ? '#fff' : 'var(--text)', borderRadius: '50%', width: 44, height: 44, padding: 0 }}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={toggleVideo} className="btn" style={{ background: isVideoOff ? 'var(--error)' : 'var(--bg-card)', color: isVideoOff ? '#fff' : 'var(--text)', borderRadius: '50%', width: 44, height: 44, padding: 0 }}>
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="btn btn-error" style={{ borderRadius: '50%', width: 44, height: 44, padding: 0 }}><PhoneOff size={20} /></button>
      </div>
    </div>
  );
}
