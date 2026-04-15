import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Message from '@/models/Message';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// GET /api/conversations/[id]/messages?limit=50&before=<messageId>
export async function GET(req, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const before = searchParams.get('before');
    const limit  = Math.min(parseInt(searchParams.get('limit') || '60'), 100);

    const convId = new mongoose.Types.ObjectId(id);
    const userId = new mongoose.Types.ObjectId(user.id);

    // Auth check: user must be a participant
    const conv = await Conversation.findOne({ _id: convId, participants: userId });
    if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const query = { conversationId: convId };
    if (before) query._id = { $lt: new mongoose.Types.ObjectId(before) };

    // Fetch newest-first then reverse for chronological display
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ messages: messages.reverse() });
  } catch (err) {
    console.error('[GET messages]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/conversations/[id]/messages
// Body: { text?, type?, audioUrl?, duration?, fileUrl?, fileName?, fileType?, fileSize? }
export async function POST(req, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const {
      text     = '',
      type     = 'text',
      audioUrl,  duration,
      fileUrl,   fileName,  fileType,  fileSize,
    } = body;

    // At least one content field must be provided
    if (!text?.trim() && !audioUrl && !fileUrl) {
      return NextResponse.json({ error: 'Message has no content' }, { status: 400 });
    }

    const convId   = new mongoose.Types.ObjectId(id);
    const senderId = new mongoose.Types.ObjectId(user.id);

    // Auth check
    const conv = await Conversation.findOne({ _id: convId, participants: senderId });
    if (!conv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Save message to DB
    const message = await Message.create({
      conversationId: convId,
      senderId,
      senderName: user.username,
      username:   user.username,
      text:       text?.trim() || '',
      type,
      audioUrl, duration,
      fileUrl,  fileName, fileType, fileSize,
    });

    // Build a human-readable lastMessage preview
    const previewText =
      type === 'audio'    ? '🎤 Voice note'  :
      type === 'image'    ? '📷 Photo'       :
      type === 'video'    ? '🎥 Video'       :
      type === 'document' ? `📎 ${fileName}` :
      text?.trim() || '';

    // Update conversation's lastMessage + sort order
    await Conversation.findByIdAndUpdate(convId, {
      updatedAt: new Date(),
      lastMessage: {
        text:       previewText,
        senderName: user.username,
        createdAt:  new Date(),
      },
    });

    return NextResponse.json({ message });
  } catch (err) {
    console.error('[POST message]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
