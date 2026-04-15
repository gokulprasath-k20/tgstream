import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// POST /api/contact/block
// Body: { userId: string }
export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

    const myId      = new mongoose.Types.ObjectId(user.id);
    const blockedId = new mongoose.Types.ObjectId(userId);

    // Add to blocked list, remove from contacts
    await User.findByIdAndUpdate(myId, {
      $addToSet: { blockedUsers: blockedId },
      $pull:     { contacts:    blockedId },
    });

    // Mark any existing conversation as a request so it leaves main inbox
    await Conversation.updateMany(
      { participants: { $all: [myId, blockedId], $size: 2 } },
      { isRequest: true, requestStatus: 'rejected' }
    );

    return NextResponse.json({ message: 'User blocked' });
  } catch (err) {
    console.error('[POST /api/contact/block]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/contact/block  →  unblock
export async function DELETE(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { userId } = await req.json();
    const myId      = new mongoose.Types.ObjectId(user.id);
    const blockedId = new mongoose.Types.ObjectId(userId);

    await User.findByIdAndUpdate(myId, { $pull: { blockedUsers: blockedId } });

    return NextResponse.json({ message: 'User unblocked' });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
