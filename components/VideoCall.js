'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream, isStripMode, isControlMode }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef();
  const pcsRef = useRef({});

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        socket.emit('ready-for-handshake');
      } catch (err) { console.error(err); }
    };
    init();
    return () => { if (localStream) localStream.getTracks().forEach(t => t.stop()); };
  }, []);

  const createPC = (targetId, stream, targetName) => {
    if (pcsRef.current[targetId]) return pcsRef.current[targetId];
    const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ... (process.env.NEXT_PUBLIC_TURN_USERNAME ? [{ urls: "turn:global.relay.metered.ca:80", username: process.env.NEXT_PUBLIC_TURN_USERNAME, credential: process.env.NEXT_PUBLIC_TURN_PASSWORD }] : [])]
    });
    pcsRef.current[targetId] = pc;
    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));
    if (localScreenStream) localScreenStream.getTracks().forEach(t => pc.addTrack(t, localScreenStream));

    pc.onicecandidate = (e) => e.candidate && socket.emit('signal', { targetId, signal: e.candidate });
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (e.streams.length > 1 || stream.id.includes('screen')) onRemoteScreenStream(stream);
      else setRemoteStreams(prev => prev.find(p => p.id === targetId) ? prev : [...prev, { id: targetId, stream, username: targetName || 'User' }]);
    };
    return pc;
  };

  useEffect(() => {
    if (!socket || !localStream) return;
    socket.on('initiate-call', async ({ id, username: name }) => {
      const pc = createPC(id, localStream, name);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId: id, signal: offer });
    });
    socket.on('signal', async ({ senderId, signal }) => {
      let pc = pcsRef.current[senderId];
      if (!pc) pc = createPC(senderId, localStream);
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { targetId: senderId, signal: answer });
      } else if (signal.type === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(signal));
      else if (signal.candidate) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    });
    socket.on('user-left', ({ id }) => {
        if (pcsRef.current[id]) { pcsRef.current[id].close(); delete pcsRef.current[id]; }
        setRemoteStreams(prev => prev.filter(p => p.id !== id));
    });
    return () => { socket.off('initiate-call'); socket.off('signal'); socket.off('user-left'); };
  }, [socket, localStream]);

  const toggleMute = () => { if (localStream) { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); } };
  const toggleVideo = () => { if (localStream) { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); } };

  // RENDERING LOGIC: Split into different parts based on layout requirements
  if (isControlMode) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={toggleMute} className={`circle-btn ${isMuted ? 'bg-[#ea4335] text-white' : ''}`}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={toggleVideo} className={`circle-btn ${isVideoOff ? 'bg-[#ea4335] text-white' : ''}`}>
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="circle-btn danger">
          <PhoneOff size={20} />
        </button>
      </div>
    );
  }

  if (isStripMode) {
    return (
      <>
        {/* Your Tile */}
        <div className="participant-tile">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="tile-overlay">You {isMuted && '🔇'}</div>
        </div>
        {/* Remote Tiles */}
        {remoteStreams.map(peer => (
          <div key={peer.id} className="participant-tile">
            <video autoPlay playsInline className="w-full h-full object-cover" ref={el => { if (el) el.srcObject = peer.stream; }} />
            <div className="tile-overlay">{peer.username}</div>
            <div onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()} className="absolute inset-0 cursor-pointer" />
          </div>
        ))}
      </>
    );
  }

  return null;
}
