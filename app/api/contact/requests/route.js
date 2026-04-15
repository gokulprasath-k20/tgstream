import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// GET /api/contact/requests  →  list pending request conversations
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(user.id);

    const requests = await Conversation.find({
      participants:  userId,
      isRequest:     true,
      requestStatus: 'pending',
    })
      .populate('participants', 'username _id publicKey')
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ requests, count: requests.length });
  } catch (err) {
    console.error('[GET /api/contact/requests]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
