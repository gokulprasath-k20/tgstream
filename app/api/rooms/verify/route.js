import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Room from '@/models/Room';

export async function POST(req) {
  try {
    await dbConnect();
    const { roomId, password } = await req.json();

    const room = await Room.findOne({ roomId });
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    if (!room.password || room.password === password) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
