'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream, isWowMode }) {
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

  useEffect(() => {
    if (!localScreenStream) return;
    Object.keys(pcsRef.current).forEach(async (id) => {
      const pc = pcsRef.current[id];
      localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { targetId: id, signal: offer });
    });
  }, [localScreenStream]);

  const toggleMute = () => { localStream.getAudioTracks()[0].enabled = isMuted; setIsMuted(!isMuted); };
  const toggleVideo = () => { localStream.getVideoTracks()[0].enabled = isVideoOff; setIsVideoOff(!isVideoOff); };

  return (
    <>
      {/* Premium Floating Tiles */}
      <div className="fixed right-10 top-10 flex flex-col gap-5 z-40 pointer-events-none">
        <div className="video-tile w-64 ring-4 ring-indigo-500/20 group pointer-events-auto">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="tile-label group-hover:bg-indigo-500/80 transition-colors">You {isMuted && '🔇'}</div>
        </div>
        {remoteStreams.map(peer => (
          <div key={peer.id} className="video-tile w-64 group pointer-events-auto">
            <video autoPlay playsInline className="w-full h-full object-cover" ref={el => { if (el) el.srcObject = peer.stream; }} />
            <div className="tile-label">{peer.username}</div>
            <div onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()} className="absolute inset-0 cursor-pointer" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : 'hover:border-indigo-500/50 hover:text-indigo-400'}`}>
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <button onClick={toggleVideo} className={`control-btn ${isVideoOff ? 'active' : 'hover:border-indigo-500/50 hover:text-indigo-400'}`}>
          {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="control-btn btn-leave">
          <PhoneOff size={24} />
        </button>
      </div>
    </>
  );
}
