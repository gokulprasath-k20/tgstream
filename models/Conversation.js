import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
  // Exactly 2 participants for 1-to-1 DMs
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],

  lastMessage: {
    text:       { type: String, default: '' },
    senderName: { type: String, default: '' },
    createdAt:  { type: Date,   default: null },
  },

  // ── Contact Request System ─────────────────────────────────────────────────
  // When sender is not in receiver's contacts (and receiver requires contacts),
  // the conversation starts as a "request" and appears in the Requests inbox.
  isRequest:     { type: Boolean, default: false },
  requestedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestStatus: {
    type:    String,
    enum:    ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },

}, { timestamps: true });

// Compound index: fast "find conversation between A and B" queries
ConversationSchema.index({ participants: 1 });

if (mongoose.models?.Conversation) delete mongoose.models.Conversation;
export default mongoose.model('Conversation', ConversationSchema);
