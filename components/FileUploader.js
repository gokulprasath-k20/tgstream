'use client';
import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, Film, Image as ImageIcon, Loader2, File } from 'lucide-react';

// ── Constants ────────────────────────────────────────────────────────────────
const ACCEPT = [
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
].join(',');

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function getMimeCategory(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
}

function fmtSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function FileUploader({ onSendFile, onClose }) {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);    // { url, type }
  const [isDragging, setDrag]   = useState(false);
  const [uploading, setUpload]  = useState(false);
  const [error, setError]       = useState('');
  const inputRef                = useRef(null);

  const processFile = (f) => {
    setError('');
    if (!f) return;
    if (!ACCEPT.split(',').includes(f.type)) {
      setError('Unsupported file type.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('File too large (max 25 MB).');
      return;
    }
    setFile(f);
    const cat = getMimeCategory(f.type);
    if (cat === 'image' || cat === 'video') {
      setPreview({ url: URL.createObjectURL(f), type: cat });
    } else {
      setPreview(null);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    processFile(e.dataTransfer.files?.[0]);
  }, []);

  const clear = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setFile(null);
    setPreview(null);
    setError('');
  };

  const handleSend = async () => {
    if (!file || uploading) return;
    setUpload(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res  = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.url) throw new Error(data.error || 'Upload failed');

      await onSendFile({
        fileUrl:  data.url,
        fileName: file.name,
        fileType: getMimeCategory(file.type),
        fileSize: file.size,
      });
      if (preview?.url) URL.revokeObjectURL(preview.url);
      onClose();
    } catch (err) {
      setError(err.message);
      setUpload(false);
    }
  };

  return (
    <div className="mx-4 mb-3 bg-[#0f1020] border border-white/10 rounded-2xl p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white">Attach File</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      {!file ? (
        // ── Drop Zone ───────────────────────────────────────────────────────
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
            isDragging
              ? 'border-indigo-500 bg-indigo-600/10 scale-[1.01]'
              : 'border-white/15 hover:border-indigo-500/50 hover:bg-white/5'
          }`}
        >
          <Upload size={28} className="mx-auto mb-3 text-gray-500" />
          <p className="text-sm text-gray-400">
            Drag & drop or <span className="text-indigo-400 font-semibold">browse</span>
          </p>
          <p className="text-xs text-gray-600 mt-1.5">Images · Videos · PDFs · DOCX — Max 25 MB</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => processFile(e.target.files?.[0])}
          />
        </div>
      ) : (
        // ── Preview + Send ──────────────────────────────────────────────────
        <div className="space-y-3">
          {preview?.type === 'image' && (
            <div className="relative rounded-xl overflow-hidden">
              <img src={preview.url} alt="preview" className="w-full max-h-56 object-cover" />
              <button
                onClick={clear}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {preview?.type === 'video' && (
            <div className="relative rounded-xl overflow-hidden">
              <video src={preview.url} controls className="w-full max-h-56 rounded-xl" />
              <button
                onClick={clear}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {getMimeCategory(file.type) === 'document' && (
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{fmtSize(file.size)}</p>
              </div>
              <button onClick={clear} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={clear}
              className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-gray-300 text-sm font-medium transition-colors"
            >
              Change
            </button>
            <button
              onClick={handleSend}
              disabled={uploading}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {uploading
                ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                : 'Send'
              }
            </button>
          </div>
        </div>
      )}

      {error && !file && (
        <p className="mt-2 text-red-400 text-xs text-center">{error}</p>
      )}
    </div>
  );
}
