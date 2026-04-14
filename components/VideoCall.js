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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socket.emit('ready-for-handshake');
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

    // Add Video/Audio Tracks
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // Add Screen Share Tracks if active
    if (localScreenStream) {
      const senders = localScreenStream.getTracks().map(track => pc.addTrack(track, localScreenStream));
      screenSendersRef.current[targetId] = senders;
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { targetId, signal: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      
      // If this is a secondary video track, it is likely a SCREEN SHARE
      if (e.track.kind === 'video' && e.streams[0].getVideoTracks().length > 1) {
        onRemoteScreenStream(new MediaStream([e.track]));
        return;
      }

      setRemoteStreams(prev => {
        if (prev.find(p => p.id === targetId)) return prev;
        return [...prev, { id: targetId, stream: remoteStream, username: targetName || 'User' }];
      });
    };

    return pc;
  };

  // 3. Signaling & Screen Toggle
  useEffect(() => {
    if (!socket || !localStream) return;

    socket.on('initiate-call', ({ id, username: name }) => {
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

    return () => {
      socket.off('initiate-call');
      socket.off('signal');
    };
  }, [socket, localStream, localScreenStream]);

  // Handle LOCAL SCREEN SHARE changes (dynamic adding/removing)
  useEffect(() => {
    if (!localScreenStream) {
      // Remove screen tracks from all PCs
      Object.keys(screenSendersRef.current).forEach(id => {
        const pc = pcsRef.current[id];
        const senders = screenSendersRef.current[id];
        if (pc && senders) {
          senders.forEach(s => pc.removeTrack(s));
          delete screenSendersRef.current[id];
        }
      });
      return;
    }

    // Add screen tracks to all active PCs
    Object.keys(pcsRef.current).forEach(id => {
      const pc = pcsRef.current[id];
      if (pc && !screenSendersRef.current[id]) {
        const senders = localScreenStream.getTracks().map(track => pc.addTrack(track, localScreenStream));
        screenSendersRef.current[id] = senders;
        // Trigger re-negotiation
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          socket.emit('signal', { targetId: id, signal: offer });
        });
      }
    });
  }, [localScreenStream]);

  const toggleMute = () => { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); };
  const toggleVideo = () => { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
        {/* You */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#000' }}>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full" style={{ minHeight: '160px', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>You {isMuted && '🔇'}</div>
        </div>

        {/* Friends */}
        {remoteStreams.map(peer => (
          <div key={peer.id} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', background: '#000' }}>
            <video autoPlay playsInline className="w-full" style={{ minHeight: '160px', objectFit: 'cover' }} ref={el => { if (el) el.srcObject = peer.stream; }} />
            <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {peer.username}
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} title="Secure Relay" />
            </div>
            <div onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }} />
          </div>
        ))}
      </div>

      <div className="flex justify-center items-center gap-3 p-3 bg-secondary rounded-xl border border-border mt-auto">
        <button onClick={toggleMute} className="btn" style={{ background: isMuted ? 'var(--error)' : 'var(--bg-card)', color: isMuted ? '#fff' : 'var(--text)', borderRadius: '50%', width: 40, height: 40, padding: 0 }}>
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button onClick={toggleVideo} className="btn" style={{ background: isVideoOff ? 'var(--error)' : 'var(--bg-card)', color: isVideoOff ? '#fff' : 'var(--text)', borderRadius: '50%', width: 40, height: 40, padding: 0 }}>
          {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="btn btn-error" style={{ borderRadius: '50%', width: 40, height: 40, padding: 0 }}><PhoneOff size={18} /></button>
      </div>
    </div>
  );
}
