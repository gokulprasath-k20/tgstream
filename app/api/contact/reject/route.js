import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// POST /api/contact/reject
// Body: { conversationId: string }
export async function POST(req) {
  try {
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { conversationId } = await req.json();
    const myId   = new mongoose.Types.ObjectId(me.id);
    const convId = new mongoose.Types.ObjectId(conversationId);

    const conv = await Conversation.findOne({ _id: convId, participants: myId, isRequest: true });
    if (!conv) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

    const otherId = conv.participants.find(id => !id.equals(myId));

    // Soft-reject the conversation
    conv.requestStatus = 'rejected';
    await conv.save();

    // Clean up request arrays on both users
    if (otherId) {
      await Promise.all([
        User.findByIdAndUpdate(myId,    { $pull: { contactRequests: otherId } }),
        User.findByIdAndUpdate(otherId, { $pull: { sentRequests:    myId    } }),
      ]);
    }

    return NextResponse.json({ message: 'Request rejected' });
  } catch (err) {
    console.error('[POST /api/contact/reject]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
