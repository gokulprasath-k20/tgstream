import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Conversation from '@/models/Conversation';
import { getAuthUser } from '@/lib/auth';
import { contactRequestLimiter } from '@/lib/rateLimit';
import { isValidTgId } from '@/lib/tgId';
import mongoose from 'mongoose';

/**
 * POST /api/contact/request
 * Body: { tgId: string }   ← find target by TG ID
 *    OR { userId: string } ← direct userId (used by mobile / programmatic)
 *
 * Sends a contact request from the current user to the target.
 * Also creates the conversation as isRequest:true so messages can be previewed.
 */
export async function POST(req) {
  try {
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: 10 requests per hour per user
    const { limited, resetIn } = contactRequestLimiter.check(me.id);
    if (limited) {
      const mins = Math.ceil(resetIn / 60000);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    await dbConnect();
    const body = await req.json();

    // Resolve target user
    let target;
    if (body.tgId) {
      if (!isValidTgId(body.tgId)) {
        return NextResponse.json({ error: 'Invalid TG ID format' }, { status: 400 });
      }
      target = await User.findOne({ tgId: new RegExp(`^${body.tgId}$`, 'i') }).lean();
    } else if (body.userId) {
      target = await User.findById(body.userId).lean();
    }

    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const myId     = new mongoose.Types.ObjectId(me.id);
    const targetId = target._id;

    // Can't request yourself
    if (myId.equals(targetId)) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
    }

    // Block check
    if (target.blockedUsers?.some(id => id.equals(myId))) {
      return NextResponse.json({ error: 'Unable to send request' }, { status: 403 });
    }

    // Already contacts?
    if (target.contacts?.some(id => id.equals(myId))) {
      return NextResponse.json({ error: 'Already in contacts' }, { status: 409 });
    }

    // Already sent a pending request?
    const sender = await User.findById(myId).lean();
    if (sender.sentRequests?.some(id => id.equals(targetId))) {
      return NextResponse.json({ error: 'Request already sent' }, { status: 409 });
    }

    // Privacy: "nobody" cannot receive requests from anyone
    if (target.chatPrivacy === 'nobody') {
      return NextResponse.json({ error: 'This user is not accepting new requests' }, { status: 403 });
    }

    // Update both User documents atomically
    await Promise.all([
      User.findByIdAndUpdate(myId,     { $addToSet: { sentRequests:    targetId } }),
      User.findByIdAndUpdate(targetId, { $addToSet: { contactRequests: myId     } }),
    ]);

    // Create (or find) a conversation marked as request
    let conversation = await Conversation.findOne({
      participants: { $all: [myId, targetId], $size: 2 },
    }).lean();

    if (!conversation) {
      const created = await Conversation.create({
        participants:  [myId, targetId],
        isRequest:     true,
        requestStatus: 'pending',
        requestedBy:   myId,
        lastMessage:   { text: '', senderName: '', createdAt: null },
      });
      conversation = await Conversation.findById(created._id)
        .populate('participants', 'username tgId _id publicKey')
        .lean();
    }

    return NextResponse.json({
      message:      'Contact request sent',
      conversation,
      targetTgId:   target.tgId,
      targetName:   target.username,
    });
  } catch (err) {
    console.error('[POST /api/contact/request]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
