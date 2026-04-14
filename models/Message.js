import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: String, // String format for easy display or Date
    required: true,
  }
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
