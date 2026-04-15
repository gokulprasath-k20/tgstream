'use client';
import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Send, Trash2, X } from 'lucide-react';

function formatSecs(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Animated waveform bars for "recording" state
function RecordingWave() {
  return (
    <div className="flex gap-0.5 items-center h-7 mx-2">
      {[3,6,4,8,5,9,4,7,3,6,5,8,4].map((h, i) => (
        <div
          key={i}
          className="w-1 bg-red-400 rounded-full animate-pulse"
          style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

// Static decorative waveform for "preview" state
function PreviewWave({ progress = 0 }) {
  const heights = [4, 8, 6, 12, 9, 14, 8, 11, 5, 9, 7, 13, 6, 10, 8];
  return (
    <div className="flex gap-0.5 items-center h-7 flex-1 mx-2">
      {heights.map((h, i) => {
        const filled = (i / heights.length) < progress;
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-colors ${filled ? 'bg-indigo-400' : 'bg-white/20'}`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceRecorder({ onSendAudio, onClose }) {
  const [state, setState]       = useState('idle');        // idle | recording | preview
  const [seconds, setSeconds]   = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');

  const recorderRef   = useRef(null);
  const chunksRef     = useRef([]);
  const streamRef     = useRef(null);
  const timerRef      = useRef(null);
  const audioRef      = useRef(null);
  const blobRef       = useRef(null);
  const objectUrlRef  = useRef(null);

  // ── Recording ────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        objectUrlRef.current = URL.createObjectURL(blob);
        setState('preview');
      };

      recorder.start(50);
      setState('recording');

      // Recording timer — max 2 min
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s >= 119) { stopRecording(); return s; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone in browser settings.');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  // ── Playback ─────────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      el.currentTime = 0;
      el.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  // ── Discard ───────────────────────────────────────────────────────────────────
  const discard = () => {
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    blobRef.current = null;
    objectUrlRef.current = null;
    setSeconds(0);
    setIsPlaying(false);
    setProgress(0);
    setState('idle');
  };

  // ── Upload + Send ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!blobRef.current || uploading) return;
    setUploading(true);
    setError('');
    try {
      const ext = blobRef.current.type.includes('webm') ? 'webm' : 'ogg';
      const formData = new FormData();
      formData.append('file', blobRef.current, `voice-${Date.now()}.${ext}`);

      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'Upload failed');

      await onSendAudio({ audioUrl: data.url, duration: seconds });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      onClose();
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <div className="mx-4 mb-3 bg-[#0f1020] border border-white/10 rounded-2xl p-4 shadow-2xl">
      {error && (
        <p className="text-red-400 text-xs mb-3 text-center bg-red-600/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* ── IDLE: prompt to start ─────────────────────────────────────────── */}
      {state === 'idle' && (
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={startRecording}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-600/30 transition-all active:scale-90"
            >
              <Mic size={26} className="text-white" />
            </button>
            <p className="text-xs text-gray-500">Tap to record</p>
          </div>
          <div className="w-5" /> {/* spacer */}
        </div>
      )}

      {/* ── RECORDING ─────────────────────────────────────────────────────── */}
      {state === 'recording' && (
        <div className="flex items-center gap-3">
          {/* Pulse dot */}
          <div className="relative flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50" />
          </div>

          <span className="font-mono text-sm text-red-400 tabular-nums w-12">{formatSecs(seconds)}</span>
          <RecordingWave />

          <button
            onClick={stopRecording}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
            title="Stop"
          >
            <Square size={14} fill="white" className="text-white" />
          </button>
        </div>
      )}

      {/* ── PREVIEW: playback before send ─────────────────────────────────── */}
      {state === 'preview' && (
        <div className="flex items-center gap-3">
          {objectUrlRef.current && (
            <audio
              ref={audioRef}
              src={objectUrlRef.current}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          )}

          {/* Discard */}
          <button
            onClick={discard}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-red-600/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isPlaying
              ? <Pause size={16} className="text-white" />
              : <Play size={16} className="text-white ml-0.5" />
            }
          </button>

          {/* Waveform */}
          <PreviewWave progress={progress} />

          {/* Duration */}
          <span className="font-mono text-xs text-gray-400 tabular-nums flex-shrink-0">{formatSecs(seconds)}</span>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={uploading}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center transition-colors"
            title="Send voice note"
          >
            {uploading
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Send size={15} className="text-white translate-x-[1px]" />
            }
          </button>
        </div>
      )}
    </div>
  );
}
