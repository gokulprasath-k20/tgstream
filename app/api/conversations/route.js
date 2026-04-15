import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Conversation from '@/models/Conversation';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// GET /api/conversations  →  main conversations only (isRequest:false or accepted)
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(user.id);

    const conversations = await Conversation.find({
      participants: userId,
      $or: [
        { isRequest: false },
        { isRequest: { $exists: false } },
        { requestStatus: 'accepted' },
      ],
    })
      .populate('participants', 'username _id publicKey')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('[GET /api/conversations]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/conversations  →  find or create DM (respects chatPrivacy)
// Body: { recipientId: string }
export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { recipientId } = await req.json();
    if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

    const myId    = new mongoose.Types.ObjectId(user.id);
    const theirId = new mongoose.Types.ObjectId(recipientId);

    // Load receiver to check privacy / block list
    const receiver = await User.findById(theirId).lean();
    if (!receiver) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Block check — blocked users cannot initiate conversations
    if (receiver.blockedUsers?.some(id => id.equals(myId))) {
      return NextResponse.json({ error: 'This user is not accepting messages.' }, { status: 403 });
    }

    // Find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, theirId], $size: 2 },
    }).populate('participants', 'username _id publicKey').lean();

    if (conversation) {
      return NextResponse.json({ conversation });
    }

    // Determine if this should be a request based on receiver's privacy settings
    const isContact = receiver.contacts?.some(id => id.equals(myId));
    const privacy   = receiver.chatPrivacy || 'everyone';

    let isRequest = false;
    if (!isContact && (privacy === 'contacts' || privacy === 'nobody')) {
      isRequest = true;
    }

    const created = await Conversation.create({
      participants:  [myId, theirId],
      lastMessage:   { text: '', senderName: '', createdAt: null },
      isRequest,
      requestStatus: isRequest ? 'pending' : 'accepted',
      requestedBy:   isRequest ? myId : undefined,
    });

    conversation = await Conversation.findById(created._id)
      .populate('participants', 'username _id publicKey')
      .lean();

    return NextResponse.json({ conversation, isRequest });
  } catch (err) {
    console.error('[POST /api/conversations]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
