import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  // ── Context (one of these is set) ──────────────────────────────────────────
  roomId:         { type: String,                           index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId,  index: true },

  // ── Sender ─────────────────────────────────────────────────────────────────
  senderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  senderName: { type: String },
  username:   { type: String },   // legacy alias for room-chat compat

  // ── Content (type determines which fields are populated) ───────────────────
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio', 'emoji', 'system'],
    default: 'text',
  },

  // text messages
  text: { type: String, default: '' },

  // voice notes
  audioUrl:  { type: String },
  duration:  { type: Number },   // seconds

  // file attachments (images, videos, documents)
  fileUrl:   { type: String },
  fileName:  { type: String },
  fileType:  { type: String },   // 'image' | 'video' | 'document'
  fileSize:  { type: Number },   // bytes

  // legacy display timestamp for room chat
  timestamp: { type: String },

}, { timestamps: true });

// Clear cached model on HMR (Next.js dev)
if (mongoose.models?.Message) delete mongoose.models.Message;

export default mongoose.model('Message', MessageSchema);
