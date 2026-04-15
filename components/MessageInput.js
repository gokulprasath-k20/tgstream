'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Smile, Mic, Paperclip, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const VoiceRecorder = dynamic(() => import('./VoiceRecorder'), { ssr: false });
const FileUploader  = dynamic(() => import('./FileUploader'),  { ssr: false });

// ── Inline emoji groups ──────────────────────────────────────────────────────
const EMOJI_GROUPS = {
  '😀':['😀','😂','🥰','😍','🤩','😎','🥺','😭','😤','🤔','😱','😴','🤗','😬','😅','😆','🤣','😊','😢','😏'],
  '👍':['👍','👎','👋','🤝','🙏','💪','✌️','🤞','👏','🙌','🫶','💃','🕺','🫡','🤦','🙄'],
  '❤️':['❤️','🧡','💛','💚','💙','💜','🖤','💔','💯','🔥','✨','🎉','💫','⭐','🌟','💥','🎊'],
  '🐶':['🐶','🐱','🦊','🐼','🦁','🐸','🦋','🐝','🦄','🐙','🦀','🐬','🦅','🌸','🌈'],
  '🍕':['🍕','🍔','🍣','🍩','🎂','🍦','☕','🧃','🍷','🧁','🍿','🌮','🍜','🥗','🍓'],
  '🎮':['🎮','🎵','🎬','📚','💻','📱','🎸','🎯','🏆','⚽','🎲','🎨','🚀','💡','🔮'],
};

export default function MessageInput({
  onSend,        // (text: string) => void
  onSendMedia,   // ({ type, audioUrl?, duration?, fileUrl?, fileName?, fileType?, fileSize? }) => void
  socket,
  conversationId,
  recipientId,
}) {
  const [text, setText]           = useState('');
  const [panel, setPanel]         = useState(null);  // null | 'emoji' | 'voice' | 'file'
  const [emojiTab, setEmojiTab]   = useState(Object.keys(EMOJI_GROUPS)[0]);
  const inputRef   = useRef(null);
  const emojiRef   = useRef(null);
  const typingRef  = useRef(false);
  const timerRef   = useRef(null);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panel === 'emoji' && emojiRef.current && !emojiRef.current.contains(e.target)) {
        setPanel(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panel]);

  // Typing indicator helpers
  const stopTyping = useCallback(() => {
    if (typingRef.current) {
      socket?.emit('typing-stop', { conversationId, recipientId });
      typingRef.current = false;
    }
  }, [socket, conversationId, recipientId]);

  const handleChange = (e) => {
    setText(e.target.value);
    if (!typingRef.current) {
      socket?.emit('typing-start', { conversationId, recipientId });
      typingRef.current = true;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(stopTyping, 2000);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    setPanel(null);
    clearTimeout(timerRef.current);
    stopTyping();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Toggle a panel — clicking the same button closes it
  const togglePanel = (name) => setPanel(p => (p === name ? null : name));

  return (
    <div className="flex-shrink-0 bg-[#0a0b15]">
      {/* ── Panels (appear above input row) ─────────────────────────────── */}

      {/* Emoji picker */}
      {panel === 'emoji' && (
        <div ref={emojiRef} className="mx-4 mb-3 bg-[#0f1020] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-white/8 px-2 pt-2 gap-1">
            {Object.keys(EMOJI_GROUPS).map(tab => (
              <button
                key={tab}
                onClick={() => setEmojiTab(tab)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-lg transition-colors ${
                  emojiTab === tab
                    ? 'bg-indigo-600/30 border-b-2 border-indigo-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-10 p-3 max-h-[180px] overflow-y-auto">
            {EMOJI_GROUPS[emojiTab].map(e => (
              <button
                key={e}
                onClick={() => { setText(t => t + e); inputRef.current?.focus(); }}
                className="text-2xl p-1.5 rounded-lg hover:bg-white/10 transition-colors leading-none"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice recorder */}
      {panel === 'voice' && (
        <VoiceRecorder
          onSendAudio={async (data) => {
            await onSendMedia({ type: 'audio', ...data });
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {/* File uploader */}
      {panel === 'file' && (
        <FileUploader
          onSendFile={async (data) => {
            await onSendMedia({ type: data.fileType, ...data });
          }}
          onClose={() => setPanel(null)}
        />
      )}

      {/* ── Input row ────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3 border-t border-white/8">
        {/* Emoji */}
        <button
          type="button"
          onClick={() => togglePanel('emoji')}
          className={`flex-shrink-0 p-2.5 rounded-xl transition-colors ${
            panel === 'emoji' ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
          }`}
          title="Emoji"
        >
          {panel === 'emoji' ? <X size={20} /> : <Smile size={20} />}
        </button>

        {/* Attach file */}
        <button
          type="button"
          onClick={() => togglePanel('file')}
          className={`flex-shrink-0 p-2.5 rounded-xl transition-colors ${
            panel === 'file' ? 'bg-indigo-600/30 text-indigo-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
          }`}
          title="Attach file"
        >
          {panel === 'file' ? <X size={20} /> : <Paperclip size={20} />}
        </button>

        {/* Text area */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 resize-none transition-colors leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
        </div>

        {/* Voice note OR send */}
        {text.trim() ? (
          <button
            type="submit"
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all"
            title="Send (Enter)"
          >
            <Send size={17} className="translate-x-[1px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => togglePanel('voice')}
            className={`flex-shrink-0 w-10 h-10 rounded-xl transition-all ${
              panel === 'voice'
                ? 'bg-red-600 text-white'
                : 'bg-white/8 hover:bg-white/12 text-gray-400 hover:text-white'
            }`}
            title="Voice note"
          >
            {panel === 'voice' ? <X size={18} /> : <Mic size={18} />}
          </button>
        )}
      </form>
    </div>
  );
}
