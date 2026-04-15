'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls:       process.env.NEXT_PUBLIC_TURN_URL || 'turn:openrelay.metered.ca:80',
      username:   process.env.NEXT_PUBLIC_TURN_USERNAME || '',
      credential: process.env.NEXT_PUBLIC_TURN_PASSWORD || '',
    },
  ],
};

function formatCallTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceCallModal({ socket, user, activeContact }) {
  // ── state ──────────────────────────────────────────────────────────────────
  const [callState, setCallState] = useState('idle'); // idle | calling | incoming | active
  const [remoteUser, setRemoteUser] = useState(null); // { id, name }
  const [isMuted, setMuted]         = useState(false);
  const [timer, setTimer]           = useState(0);
  const [callError, setCallError]   = useState('');

  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef       = useRef(null);
  const pendingIceRef  = useRef([]);  // ICE candidates received before remote description

  // ── WebRTC helpers ─────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    localStreamRef.current = null;
    pcRef.current          = null;
    pendingIceRef.current  = [];
    setTimer(0);
    setMuted(false);
    setCallState('idle');
    setRemoteUser(null);
  }, []);

  const createPC = useCallback((recipientId) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('voice-call-signal', {
          recipientId,
          signal: { type: 'ice', candidate },
        });
      }
    };

    pc.ontrack = ({ streams }) => {
      if (remoteAudioRef.current && streams[0]) {
        remoteAudioRef.current.srcObject = streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket]);

  const startCallTimer = () => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  };

  // ── OUTBOUND: user initiates call ──────────────────────────────────────────
  const initiateCall = useCallback(async (contactId, contactName) => {
    if (callState !== 'idle') return;
    setCallError('');
    setCallState('calling');
    setRemoteUser({ id: contactId, name: contactName });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPC(contactId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('voice-call-user', {
        recipientId: contactId,
        callerName:  user.username,
      });

      // Send SDP offer after callee accepts (done in accept handler)
      pcRef.current._pendingOffer = offer;
      pcRef.current._recipientId  = contactId;

    } catch (err) {
      setCallError('Could not access microphone.');
      cleanup();
    }
  }, [callState, createPC, socket, user, cleanup]);

  const endCall = useCallback(() => {
    if (remoteUser?.id) {
      socket.emit('voice-call-end', { recipientId: remoteUser.id });
    }
    cleanup();
  }, [socket, remoteUser, cleanup]);

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    tracks.forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };

  // ── Socket event handlers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // INCOMING call ring
    const onIncoming = ({ callerId, callerName }) => {
      if (callState !== 'idle') {
        // Auto-reject if already in a call
        socket.emit('voice-call-reject', { callerId });
        return;
      }
      setRemoteUser({ id: callerId, name: callerName });
      setCallState('incoming');
    };

    // Callee accepted our outgoing call — send offer
    const onAccepted = async () => {
      setCallState('active');
      startCallTimer();
      const pc      = pcRef.current;
      if (!pc) return;
      const offer   = pc._pendingOffer;
      if (offer) {
        socket.emit('voice-call-signal', {
          recipientId: pc._recipientId,
          signal:      { type: 'sdp', sdp: offer },
        });
      }
    };

    const onRejected = () => {
      setCallError('Call was declined.');
      cleanup();
    };

    const onEnded = () => {
      setCallError('Call ended.');
      cleanup();
    };

    // SDP / ICE relay
    const onSignal = async ({ senderId, signal }) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (signal.type === 'sdp') {
        const desc = signal.sdp;
        await pc.setRemoteDescription(new RTCSessionDescription(desc));

        // If we're the callee, create and send answer
        if (desc.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice-call-signal', {
            recipientId: senderId,
            signal:      { type: 'sdp', sdp: answer },
          });
        }

        // Flush buffered ICE candidates
        for (const c of pendingIceRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingIceRef.current = [];

      } else if (signal.type === 'ice') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          pendingIceRef.current.push(signal.candidate);
        }
      }
    };

    socket.on('incoming-voice-call',  onIncoming);
    socket.on('voice-call-accepted',  onAccepted);
    socket.on('voice-call-rejected',  onRejected);
    socket.on('voice-call-ended',     onEnded);
    socket.on('voice-call-signal',    onSignal);

    return () => {
      socket.off('incoming-voice-call',  onIncoming);
      socket.off('voice-call-accepted',  onAccepted);
      socket.off('voice-call-rejected',  onRejected);
      socket.off('voice-call-ended',     onEnded);
      socket.off('voice-call-signal',    onSignal);
    };
  }, [socket, callState, createPC, cleanup]);

  // ── Answer incoming call ───────────────────────────────────────────────────
  const answerCall = useCallback(async () => {
    const callerId = remoteUser?.id;
    if (!callerId) return;
    setCallError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPC(callerId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      socket.emit('voice-call-accept', { callerId });
      setCallState('active');
      startCallTimer();
    } catch {
      setCallError('Could not access microphone.');
      socket.emit('voice-call-reject', { callerId });
      cleanup();
    }
  }, [remoteUser, createPC, socket, cleanup]);

  const rejectCall = useCallback(() => {
    if (remoteUser?.id) socket.emit('voice-call-reject', { callerId: remoteUser.id });
    cleanup();
  }, [remoteUser, socket, cleanup]);

  // Expose initiateCall to parent via window (simple, avoids prop drilling)
  useEffect(() => {
    window.__initiateVoiceCall = initiateCall;
    return () => { delete window.__initiateVoiceCall; };
  }, [initiateCall]);

  // ── Cleanup timer on unmount ───────────────────────────────────────────────
  useEffect(() => () => { clearInterval(timerRef.current); }, []);

  if (callState === 'idle') return (
    <audio ref={remoteAudioRef} autoPlay hidden />
  );

  // ── INCOMING call screen ───────────────────────────────────────────────────
  if (callState === 'incoming') {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center">
        <audio ref={remoteAudioRef} autoPlay hidden />
        <div className="bg-[#0f1020] border border-white/10 rounded-3xl p-10 flex flex-col items-center gap-6 w-80 shadow-2xl animate-slide-up">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-4xl shadow-xl shadow-indigo-600/40 animate-pulse">
              {remoteUser?.name?.[0]?.toUpperCase()}
            </div>
          </div>
          <div className="text-center">
            <p className="font-bold text-white text-xl">{remoteUser?.name}</p>
            <p className="text-gray-400 text-sm mt-1">Incoming voice call…</p>
          </div>
          <div className="flex gap-10 mt-2">
            {/* Reject */}
            <button onClick={rejectCall} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 transition-all active:scale-90">
              <PhoneOff size={26} className="text-white" />
            </button>
            {/* Accept */}
            <button onClick={answerCall} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center shadow-lg shadow-green-500/30 transition-all active:scale-90">
              <Phone size={26} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── CALLING | ACTIVE call screen ───────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[10000] bg-[#06070f] flex flex-col items-center justify-center gap-6">
      <audio ref={remoteAudioRef} autoPlay hidden />

      {/* Avatar with ring animation */}
      <div className={`relative ${callState === 'calling' ? 'animate-pulse' : ''}`}>
        <div className="w-28 h-28 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white text-5xl shadow-2xl shadow-indigo-600/30">
          {remoteUser?.name?.[0]?.toUpperCase()}
        </div>
        {callState === 'active' && (
          <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-30" />
        )}
      </div>

      <div className="text-center">
        <p className="font-bold text-white text-2xl">{remoteUser?.name}</p>
        <p className="text-gray-400 mt-1 text-sm">
          {callState === 'calling' ? 'Calling…' : formatCallTime(timer)}
        </p>
        {callError && <p className="text-red-400 text-xs mt-2">{callError}</p>}
      </div>

      {/* Controls */}
      <div className="flex gap-8 mt-4">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-600/30 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* End call */}
        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 transition-all active:scale-90"
        >
          <PhoneOff size={26} className="text-white" />
        </button>
      </div>
    </div>
  );
}
