'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorOff } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream, isGMeetMode }) {
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
      if (e.streams.length > 1 || stream.id.includes('screen')) {
        onRemoteScreenStream(stream);
      } else {
        setRemoteStreams(prev => prev.find(p => p.id === targetId) ? prev : [...prev, { id: targetId, stream, username: targetName || 'User' }]);
      }
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
      else if (signal.candidate) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(e => {});
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
      {/* 1. The GMeet Floating Grid (Positioned in the room view) */}
      <div className="fixed right-6 top-32 flex flex-col gap-4 pointer-events-none" style={{ zIndex: 40 }}>
        {/* Your Preview Card */}
        <div className="w-56 aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg border-2 border-transparent hover:border-blue-500 transition-all pointer-events-auto">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white">You {isMuted && '🔇'}</div>
        </div>

        {/* Remote Users Card */}
        {remoteStreams.map(peer => (
          <div key={peer.id} className="w-56 aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg pointer-events-auto group relative">
            <video autoPlay playsInline className="w-full h-full object-cover" ref={el => { if (el) el.srcObject = peer.stream; }} />
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 rounded text-[10px] text-white">{peer.username}</div>
            <div onClick={(e) => e.currentTarget.parentElement.querySelector('video').play()} className="absolute inset-0 cursor-pointer" />
          </div>
        ))}
      </div>

      {/* 2. The GMeet Control Pill (Centered in bottom bar) */}
      <div className="flex items-center gap-3">
        <button 
            onClick={toggleMute} 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ea4335] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button 
            onClick={toggleVideo} 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-[#ea4335] text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'}`}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button 
            onClick={() => window.location.href = '/dashboard'} 
            className="w-12 h-12 rounded-full bg-[#ea4335] text-white hover:bg-[#d93025] flex items-center justify-center shadow-lg hover:shadow-red-500/20"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </>
  );
}
