'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MoreVertical } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [speakingStatus, setSpeakingStatus] = useState({});

  const localVideoRef = useRef();
  const pcsRef = useRef({}); // { socketId: RTCPeerConnection }
  const analysersRef = useRef({});

  // 1. Initialize Local Camera
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Tell the server we are ready for calls
        socket.emit('ready-for-calls', { roomId });
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

    // Add local tracks
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // Handle ICE
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { roomId, targetId, signal: e.candidate });
      }
    };

    // Handle Tracks
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

    socket.on('user-joined', ({ id, username: name }) => {
      console.log("User joined, sending offer to:", name);
      const pc = createPC(id, localStream, name);
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        socket.emit('signal', { roomId, targetId: id, signal: offer });
      });
    });

    socket.on('signal', async ({ senderId, signal }) => {
      let pc = pcsRef.current[senderId];
      if (!pc) pc = createPC(senderId, localStream);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { roomId, targetId: senderId, signal: answer });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(e => {});
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
      socket.off('user-joined');
      socket.off('signal');
      socket.off('user-left');
    };
  }, [socket, localStream]);

  const toggleMute = () => {
    localStream.getAudioTracks()[0].enabled = isMuted;
    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    localStream.getVideoTracks()[0].enabled = isVideoOff;
    setIsVideoOff(!isVideoOff);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Scrollable Video Grid */}
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 custom-scrollbar">
        {/* Local Preview */}
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-transparent">
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full object-cover" 
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium">
            You {isMuted && '🔇'}
          </div>
        </div>

        {/* Remote Peers */}
        {remoteStreams.map(peer => (
          <div key={peer.id} className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-transparent">
            <video 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
              ref={el => { if (el) el.srcObject = peer.stream; }}
              onClick={(e) => e.target.play()}
            />
            {/* Fallback Overlay */}
            <div 
              className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/5 pointer-events-none"
              onClick={(e) => {
                const v = e.currentTarget.parentElement.querySelector('video');
                if (v) v.play();
              }}
            >
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] pointer-events-auto hover:bg-white/20 transition-all">
                Trouble seeing? Tap to play
              </div>
            </div>
            
            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
              {peer.username}
              {process.env.NEXT_PUBLIC_TURN_USERNAME && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="Relay Active" />}
            </div>
          </div>
        ))}

        {remoteStreams.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/10 rounded-2xl">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
              <MoreVertical className="text-white/20" />
            </div>
            <p className="text-white/40 text-xs">Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="glass-morphism p-3 rounded-2xl flex justify-center items-center gap-4">
        <button 
          onClick={toggleMute}
          className={`p-3 rounded-xl transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white hover:bg-white/10'}`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button 
          onClick={toggleVideo}
          className={`p-3 rounded-xl transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-white/5 text-white hover:bg-white/10'}`}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="p-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      <style jsx>{`
        .glass-morphism {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}
