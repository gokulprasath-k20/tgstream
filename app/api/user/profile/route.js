import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

// GET /api/user/profile  →  own full profile (safe to display)
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findById(authUser.id)
      .select('username tgId bio chatPrivacy publicKey createdAt _id')  // phone excluded
      .lean();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ profile: user });
  } catch (err) {
    console.error('[GET /api/user/profile]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH /api/user/profile  →  update bio + chatPrivacy
// Body: { bio?, chatPrivacy? }
export async function PATCH(req) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { bio, chatPrivacy } = await req.json();

    const updates = {};
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 160) {
        return NextResponse.json({ error: 'Bio must be under 160 characters' }, { status: 400 });
      }
      updates.bio = bio.trim();
    }
    if (chatPrivacy !== undefined) {
      if (!['everyone', 'contacts', 'nobody'].includes(chatPrivacy)) {
        return NextResponse.json({ error: 'Invalid chatPrivacy value' }, { status: 400 });
      }
      updates.chatPrivacy = chatPrivacy;
    }

    const updated = await User.findByIdAndUpdate(
      authUser.id, updates,
      { new: true, select: 'username tgId bio chatPrivacy _id' }
    ).lean();

    return NextResponse.json({ profile: updated, message: 'Profile updated' });
  } catch (err) {
    console.error('[PATCH /api/user/profile]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
