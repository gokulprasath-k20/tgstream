import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

// GET /api/keys  →  get current user's public key
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const me = await User.findById(user.id).select('publicKey').lean();
    return NextResponse.json({ publicKey: me?.publicKey || null });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/keys  →  store / update public key (sent once at first load)
// Body: { publicKey: string }  (spki, base64)
export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { publicKey } = await req.json();
    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json({ error: 'publicKey required' }, { status: 400 });
    }

    // Basic length guard (P-256 spki ≈ 120 chars base64)
    if (publicKey.length < 80 || publicKey.length > 300) {
      return NextResponse.json({ error: 'Invalid public key format' }, { status: 400 });
    }

    await User.findByIdAndUpdate(user.id, { publicKey });
    return NextResponse.json({ message: 'Public key stored' });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/keys?userId=xxx  →  fetch another user's public key for encryption
export { GET as HEAD };
