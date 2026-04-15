import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// POST /api/contact/accept  →  accept a pending contact/message request
// Body: { conversationId: string }
export async function POST(req) {
  try {
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { conversationId } = await req.json();
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });

    const myId   = new mongoose.Types.ObjectId(me.id);
    const convId = new mongoose.Types.ObjectId(conversationId);

    const conv = await Conversation.findOne({ _id: convId, participants: myId, isRequest: true })
      .populate('participants', '_id username tgId publicKey');
    if (!conv) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const other = conv.participants.find(p => !p._id.equals(myId));
    if (!other) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });

    // Upgrade conversation
    conv.isRequest     = false;
    conv.requestStatus = 'accepted';
    await conv.save();

    // Update both User documents: add to contacts, clean up request arrays
    await Promise.all([
      User.findByIdAndUpdate(myId, {
        $addToSet: { contacts:        other._id },
        $pull:     { contactRequests: other._id },   // clear incoming request
      }),
      User.findByIdAndUpdate(other._id, {
        $addToSet: { contacts:     myId },
        $pull:     { sentRequests: myId },           // clear outgoing request
      }),
    ]);

    const updated = await Conversation.findById(convId)
      .populate('participants', 'username tgId _id publicKey')
      .lean();

    return NextResponse.json({ conversation: updated, message: 'Request accepted' });
  } catch (err) {
    console.error('[POST /api/contact/accept]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
