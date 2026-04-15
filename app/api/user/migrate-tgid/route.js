import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { generateUniqueTgId } from '@/lib/tgId';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

/**
 * POST /api/user/migrate-tgid
 * Assigns a TG ID to existing users who signed up before this feature existed.
 * Safe to call multiple times (idempotent — skips if already has tgId).
 */
export async function POST() {
  try {
    const me = await getAuthUser();
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findById(me.id).lean();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Already has a TG ID — return it without changes
    if (user.tgId) {
      return NextResponse.json({ tgId: user.tgId, alreadyHad: true });
    }

    // Generate and assign
    const tgId = await generateUniqueTgId();
    await User.findByIdAndUpdate(me.id, { tgId });

    // Re-issue JWT with tgId included
    const newToken = signToken({
      id:          me.id,
      username:    me.username,
      email:       me.email,
      tgId,
      chatPrivacy: user.chatPrivacy || 'everyone',
    });

    const cookieStore = await cookies();
    cookieStore.set('token', newToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   3600,
      path:     '/',
    });

    return NextResponse.json({ tgId, alreadyHad: false, message: 'TG ID assigned' });
  } catch (err) {
    console.error('[POST /api/user/migrate-tgid]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
