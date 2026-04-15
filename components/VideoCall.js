'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// ── Separate component so each remote video has its own ref ──────────────────
function RemoteVideo({ peer }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !peer.stream) return;
    if (el.srcObject !== peer.stream) {
      el.srcObject = peer.stream;
      el.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div className="relative aspect-video bg-[#0f0f13] rounded-2xl overflow-hidden border border-white/10 hover:border-indigo-500/40 transition-all group">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <span className="text-[10px] font-bold text-white uppercase tracking-widest">
          {peer.username}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VideoCall({
  socket,
  roomId,
  username,
  localScreenStream,
  onRemoteScreenStream,
  isStripMode,
  isControlMode,
  muted,
  videoOff,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]); // [{ id, stream, username }]

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);          // always points to current stream
  const pcsRef = useRef({});                     // { peerId: RTCPeerConnection }
  const pendingCandidates = useRef({});          // { peerId: RTCIceCandidateInit[] }
  const screenSendersRef = useRef({});           // { peerId: RTCRtpSender[] }
  const peerNamesRef = useRef({});               // { peerId: username }
  const peerStreamIdsRef = useRef({});           // { peerId: string[] } - ordered list of stream IDs seen

  // ── 1. Acquire Camera ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isControlMode) return;
    if (!socket) return;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        // 'motion' hint tells the browser this is a live webcam — prioritise smoothness
        stream.getVideoTracks().forEach(t => { t.contentHint = 'motion'; });
        localStreamRef.current = stream;
        setLocalStream(stream);
        socket.emit('ready-for-handshake');
      })
      .catch((err) => {
        console.error('[WebRTC] Camera error:', err);
      });

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      screenSendersRef.current = {};
      pendingCandidates.current = {};
    };
  }, [isControlMode, socket]);

  // ── 2. Ref callback for local video — sets srcObject immediately on mount ────
  const localVideoCallbackRef = useCallback((el) => {
    localVideoRef.current = el;
    if (el) {
      // Set stream if already available, otherwise wait for localStream effect
      const stream = localStreamRef.current;
      if (stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }
  }, []);

  // Also bind when stream becomes available after element already mounted
  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [localStream]);

  // ── 3. Apply Mute / Video-Off to tracks ─────────────────────────────────────
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !muted; });
    stream.getVideoTracks().forEach(t => { t.enabled = !videoOff; });
  }, [muted, videoOff]);

  // ── 4. Create Peer Connection ────────────────────────────────────────────────
  const createPC = useCallback((peerId, peerName) => {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    console.log(`[WebRTC] Creating PC for ${peerName || peerId}`);
    peerNamesRef.current[peerId] = peerName;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[peerId] = pc;
    screenSendersRef.current[peerId] = [];

    // Add camera tracks
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    // ICE
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('signal', { targetId: peerId, signal: { type: 'candidate', candidate: e.candidate } });
      }
    };

    // Negotiation (fires after addTrack / removeTrack)
    pc.onnegotiationneeded = async () => {
      if (pc.signalingState !== 'stable') return;
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return; // double-check
        await pc.setLocalDescription(offer);
        socket.emit('signal', { targetId: peerId, signal: pc.localDescription });
      } catch (err) {
        console.error('[WebRTC] Offer error:', err);
      }
    };

    // ── Apply encoding parameters after connection (can't set before negotiation) ──
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== 'connected') return;
      pc.getSenders().forEach(sender => {
        if (!sender.track) return;
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) return;
        if (sender.track.kind === 'video') {
          const isScreen = sender.track.contentHint === 'detail';
          params.encodings[0].maxBitrate = isScreen ? 3_500_000 : 1_500_000;
          params.encodings[0].maxFramerate = 30;
          if (isScreen) params.encodings[0].priority = 'high';
          sender.setParameters(params).catch(() => {});
        }
        if (sender.track.kind === 'audio') {
          params.encodings[0].priority = 'high';
          sender.setParameters(params).catch(() => {});
        }
      });
    };

    // ── Incoming tracks — stream-order detection (no kind filter so audio is included) ──
    // All tracks from same stream share the same e.streams[0] reference.
    // We process each STREAM once (on whichever track fires first).
    // 1st stream from a peer = camera, 2nd+ = screen share (with its audio).
    pc.ontrack = (e) => {
      const inStream = e.streams[0];
      if (!inStream) return;

      if (!peerStreamIdsRef.current[peerId]) peerStreamIdsRef.current[peerId] = [];
      const seen = peerStreamIdsRef.current[peerId];

      // Skip if we've already triggered for this stream
      if (seen.includes(inStream.id)) return;
      seen.push(inStream.id);

      console.log(`[WebRTC] stream #${seen.length} from ${peerName}: ${inStream.getTracks().map(t => t.kind).join('+')}, id=${inStream.id.slice(0, 8)}`);

      if (seen.length === 1) {
        // First stream = camera
        setRemoteStreams(prev => {
          if (prev.find(p => p.id === peerId && p.stream.id === inStream.id)) return prev;
          const without = prev.filter(p => p.id !== peerId);
          return [...without, { id: peerId, stream: inStream, username: peerName || 'User' }];
        });
      } else {
        // Subsequent streams = screen share — stream already has both video + audio tracks
        onRemoteScreenStream?.(inStream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    // Drain any buffered candidates
    if (pendingCandidates.current[peerId]) {
      pendingCandidates.current[peerId].forEach(c => {
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      });
      delete pendingCandidates.current[peerId];
    }

    return pc;
  }, [socket, onRemoteScreenStream]);

  // ── 5. Screen Share Track Sync ───────────────────────────────────────────────
  useEffect(() => {
    if (isControlMode) return;

    Object.keys(pcsRef.current).forEach(id => {
      const pc = pcsRef.current[id];

      // Remove old screen senders
      screenSendersRef.current[id]?.forEach(s => {
        try { pc.removeTrack(s); } catch (e) {}
      });
      screenSendersRef.current[id] = [];

      if (localScreenStream) {
        // Set quality hint so browser optimises for text/UI instead of motion
        localScreenStream.getVideoTracks().forEach(t => { t.contentHint = 'detail'; });
        // Add all tracks — video + audio (system/tab audio if user permitted it)
        localScreenStream.getTracks().forEach(track => {
          const sender = pc.addTrack(track, localScreenStream);
          screenSendersRef.current[id].push(sender);
        });
      }
    });
  }, [localScreenStream, isControlMode]);

  // ── 6. Socket Signaling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || isControlMode) return;

    const handleInitiateCall = ({ id: peerId, username: peerName }) => {
      console.log(`[WebRTC] initiate-call from ${peerName}`);
      peerNamesRef.current[peerId] = peerName;
      createPC(peerId, peerName);
    };

    const handleSignal = async ({ senderId, senderName, signal }) => {
      // Pre-register the name if we haven't seen this peer yet
      if (senderName && !peerNamesRef.current[senderId]) {
        peerNamesRef.current[senderId] = senderName;
      }
      const peerName = peerNamesRef.current[senderId] || senderName || 'User';

      let pc = pcsRef.current[senderId];
      if (signal.type === 'offer') {
        if (!pc) pc = createPC(senderId, peerName);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { targetId: senderId, signal: pc.localDescription });
        } catch (err) {
          console.error('[WebRTC] Answer error:', err);
        }
      } else if (signal.type === 'answer') {
        if (!pc) return;
        try {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          }
        } catch (err) {
          console.error('[WebRTC] Set answer error:', err);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (!pc) {
          // Buffer until PC is created
          if (!pendingCandidates.current[senderId]) pendingCandidates.current[senderId] = [];
          pendingCandidates.current[senderId].push(signal.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (err) {
          // Non-fatal
        }
      }
    };

    const handleUserLeft = ({ id: peerId }) => {
      pcsRef.current[peerId]?.close();
      delete pcsRef.current[peerId];
      delete screenSendersRef.current[peerId];
      delete pendingCandidates.current[peerId];
      setRemoteStreams(prev => prev.filter(p => p.id !== peerId));
    };

    socket.on('initiate-call', handleInitiateCall);
    socket.on('signal', handleSignal);
    socket.on('user-left', handleUserLeft);

    // Pre-populate names from existing users already in the room
    socket.on('existing-users', (users) => {
      users.forEach(u => { peerNamesRef.current[u.id] = u.username; });
    });

    return () => {
      socket.off('initiate-call', handleInitiateCall);
      socket.off('signal', handleSignal);
      socket.off('user-left', handleUserLeft);
      socket.off('existing-users');
    };
  }, [socket, isControlMode, createPC]);

  // ── 7. Render ────────────────────────────────────────────────────────────────
  if (isControlMode) {
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={() => socket.emit('toggle-mute', roomId)}
          className={`circle-btn ${muted ? 'danger' : ''}`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          onClick={() => socket.emit('toggle-video', roomId)}
          className={`circle-btn ${videoOff ? 'danger' : ''}`}
          title={videoOff ? 'Show Camera' : 'Hide Camera'}
        >
          {videoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          className="circle-btn danger"
          title="Leave"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    );
  }

  if (isStripMode) {
    return (
      <div className="flex flex-col gap-4 overflow-y-auto h-full px-2 py-4">
        {/* Local Camera */}
        <div className="relative aspect-video bg-[#0f0f13] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
          <video
            ref={localVideoCallbackRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {videoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f13]">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-xl">
                {username?.[0]?.toUpperCase()}
              </div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">
              You{muted ? ' 🔇' : ''}
            </span>
          </div>
        </div>

        {/* Remote Cameras */}
        {remoteStreams.map(peer => (
          <RemoteVideo key={peer.id} peer={peer} />
        ))}

        {remoteStreams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-30">
            <div className="w-10 h-10 rounded-xl border border-white/20 flex items-center justify-center mb-3">
              <Video size={18} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Waiting for others</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
