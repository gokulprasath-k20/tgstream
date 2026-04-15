import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { generateUniqueTgId } from '@/lib/tgId';

export async function POST(req) {
  try {
    await dbConnect();
    const { username, email, password, phone } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: 'Please provide all required details' }, { status: 400 });
    }

    // Validate username (alphanumeric + underscore, 3–20 chars)
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ error: 'Username must be 3-20 characters (letters, numbers, underscores)' }, { status: 400 });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return NextResponse.json({ error: 'Email or username already taken' }, { status: 400 });
    }

    // Auto-generate TG ID
    const tgId = await generateUniqueTgId();

    const user = await User.create({
      username,
      email,
      password,
      tgId,
      phone: phone || undefined,   // optional, stored private
    });

    return NextResponse.json({
      message: 'Account created successfully',
      tgId,    // shown once at registration so user can note it down
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/auth/signup]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
