import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    await dbConnect();
    const userId = new mongoose.Types.ObjectId(user.id);

    // Save token using $addToSet so we don't have duplicates
    await User.updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/users/fcm-token]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
