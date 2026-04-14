import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';
import { cookies } from 'next/headers';

const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export async function POST(req) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const now = Date.now();
    
    // Simple Rate Limiting
    const attempts = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
      attempts.count = 0;
      attempts.firstAttempt = now;
    }
    
    if (attempts.count >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    await dbConnect();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Please provide email and password' }, { status: 400 });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      attempts.count++;
      loginAttempts.set(ip, attempts);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Reset on success
    loginAttempts.delete(ip);

    const token = signToken({ id: user._id, username: user.username, email: user.email });

    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600, // 1 hour
      path: '/',
    });

    return NextResponse.json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
