'use client';
import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function VideoCall({ socket, roomId, username, localScreenStream, onRemoteScreenStream }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]); // Array of { id, stream, username }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [speakingStatus, setSpeakingStatus] = useState({}); // { [id]: boolean }
  const peersRef = useRef({}); // { socketId: RTCPeerConnection }
  const screenSendersRef = useRef({}); // { socketId: [RTCRtpSender] }
  const analysersRef = useRef({}); // { [id]: AnalyserNode }
  const localVideoRef = useRef(null);

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setupAudioAnalyzer(stream, 'local');
      return stream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      return null;
    }
  };

  const setupAudioAnalyzer = (stream, id) => {
    if (!stream || stream.getAudioTracks().length === 0) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analysersRef.current[id] = { analyser, audioContext };

      const checkVolume = () => {
        if (!analysersRef.current[id]) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((p, c) => p + c, 0) / bufferLength;
        const isSpeaking = average > 30; // Threshold

        setSpeakingStatus(prev => {
          if (prev[id] === isSpeaking) return prev;
          return { ...prev, [id]: isSpeaking };
        });

        requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.error("Audio analyzer error:", err);
    }
  };


  useEffect(() => {
    if (!socket) return;

    // Listen for signaling even before local stream is ready
    socket.on('signal', async ({ senderId, signal }) => {
      let pc = peersRef.current[senderId];
      if (!pc) {
        // Wait for local stream if not ready
        const stream = localStream || await initLocalStream();
        if (!stream) return;
        pc = createPeerConnection(senderId, stream);
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { roomId, targetId: senderId, signal: answer });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal));
      }
    });

    const startCall = async () => {
      const stream = localStream || await initLocalStream();
      if (!stream) return;

      socket.on('user-joined', async ({ id, username: otherName }) => {
        const pc = createPeerConnection(id, stream, otherName);
        if (localScreenStream) {
          localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', { roomId, targetId: id, signal: offer });
      });

      socket.on('user-left', ({ id }) => {
        if (peersRef.current[id]) {
          peersRef.current[id].close();
          delete peersRef.current[id];
          setRemoteStreams((prev) => prev.filter((p) => p.id !== id));
        }
      });

      socket.on('existing-users', (users) => {
        users.forEach(async (u) => {
          const pc = createPeerConnection(u.id, stream, u.username);
          if (localScreenStream) {
            localScreenStream.getTracks().forEach(track => pc.addTrack(track, localScreenStream));
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', { roomId, targetId: u.id, signal: offer });
        });
      });
    };

    startCall();

    return () => {
      socket.off('user-joined');
      socket.off('signal');
      socket.off('user-left');
      socket.off('existing-users');
    };
  }, [socket, localStream]);

  // Handle local screen stream changes
  useEffect(() => {
    if (localScreenStream) {
      Object.entries(peersRef.current).forEach(([id, pc]) => {
        const senders = localScreenStream.getTracks().map(track => pc.addTrack(track, localScreenStream));
        screenSendersRef.current[id] = senders;
        
        // Re-negotiate
        pc.createOffer().then(offer => {
          pc.setLocalDescription(offer);
          socket.emit('signal', { roomId, targetId: id, signal: offer });
        });
      });
    } else {
      // Remove screen tracks
      Object.entries(peersRef.current).forEach(([id, pc]) => {
        const senders = screenSendersRef.current[id];
        if (senders) {
          senders.forEach(sender => pc.removeTrack(sender));
          delete screenSendersRef.current[id];
          
          // Re-negotiate
          pc.createOffer().then(offer => {
            pc.setLocalDescription(offer);
            socket.emit('signal', { roomId, targetId: id, signal: offer });
          });
        }
      });
    }
  }, [localScreenStream, socket, roomId]);

  const createPeerConnection = (targetId, stream, targetName) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' },
        
        // TURN servers (Only add if credentials exist)
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
          },
          {
            urls: "turn:global.relay.metered.ca:443?transport=tcp",
            username: process.env.NEXT_PUBLIC_TURN_USERNAME,
            credential: process.env.NEXT_PUBLIC_TURN_PASSWORD
          }
        ] : [])
      ]
    });

    peersRef.current[targetId] = pc;

    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { roomId, targetId, signal: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      console.log(`[WebRTC] Received track: ${e.track.kind} from ${targetId}`);
      const remoteStream = e.streams[0] || new MediaStream([e.track]);
      
      setRemoteStreams((prev) => {
        const existingPeer = prev.find(p => p.id === targetId);
        
        if (existingPeer) {
          // If we already have this peer, check if this is a NEW video track (Screen Share)
          if (e.track.kind === 'video') {
            const videoTracks = existingPeer.stream.getVideoTracks();
            // If it's a second video track, it's a screen share
            if (videoTracks.length > 0 && videoTracks[0].id !== e.track.id) {
              const screenStream = new MediaStream([e.track]);
              onRemoteScreenStream(screenStream);
              return prev;
            }
          }

          if (!existingPeer.stream.getTracks().find(t => t.id === e.track.id)) {
            existingPeer.stream.addTrack(e.track);
          }
          return [...prev]; 
        }

        setupAudioAnalyzer(remoteStream, targetId);
        return [...prev, { id: targetId, stream: remoteStream, username: targetName || 'User' }];
      });
    };

    return pc;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(analysersRef.current).forEach(({ audioContext }) => {
        audioContext.close();
      });
      analysersRef.current = {};
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', overflowY: 'auto' }}>
        {/* Local Video */}
        <div className={`card ${speakingStatus['local'] ? 'speaking-pulse' : ''}`} style={{ transition: 'var(--transition)', padding: '0', position: 'relative', background: '#000', borderRadius: '1rem', overflow: 'hidden', height: '200px' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            className="w-full h-full" 
            style={{ objectFit: 'cover', transform: 'scaleX(-1)' }} 
          />
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
            You {isMuted && '(Muted)'}
          </div>
        </div>

        {/* Remote Videos */}
        {remoteStreams.map((peer) => (
          <div key={peer.id} className={`card ${speakingStatus[peer.id] ? 'speaking-pulse' : ''}`} style={{ transition: 'var(--transition)', padding: '0', position: 'relative', background: '#000', borderRadius: '1rem', overflow: 'hidden', height: '200px' }}>
            <video 
              autoPlay 
              playsInline 
              className="w-full h-full" 
              style={{ objectFit: 'cover' }}
              ref={el => { if (el) el.srcObject = peer.stream; }}
            />
            <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
              {peer.username}
            </div>
          </div>
        ))}
      </div>

      <div className="glass flex justify-center gap-4" style={{ padding: '1rem', borderRadius: '1rem' }}>
        <button onClick={toggleMute} className={`btn ${isMuted ? 'btn-secondary' : 'btn-primary'}`} style={{ borderRadius: '50%', width: '45px', height: '45px', padding: '0' }}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={toggleVideo} className={`btn ${isVideoOff ? 'btn-secondary' : 'btn-primary'}`} style={{ borderRadius: '50%', width: '45px', height: '45px', padding: '0' }}>
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button onClick={() => window.location.href = '/dashboard'} className="btn btn-error" style={{ borderRadius: '50%', width: '45px', height: '45px', padding: '0', background: 'var(--error)', color: 'white' }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}


