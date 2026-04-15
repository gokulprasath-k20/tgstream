import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import mongoose from 'mongoose';

// GET /api/contact/list  →  return contact list for current user
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const me = await User.findById(user.id)
      .populate('contacts', 'username _id publicKey lastSeen')
      .lean();

    return NextResponse.json({ contacts: me?.contacts || [] });
  } catch (err) {
    console.error('[GET /api/contact/list]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
