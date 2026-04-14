import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Room from '@/models/Room';
import { getAuthUser } from '@/lib/auth';

export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { roomId, password } = await req.json();

    const room = await Room.create({
      roomId,
      hostId: user.id,
      password: password || null,
    });

    return NextResponse.json({ message: 'Room created', room });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    
    await dbConnect();
    const room = await Room.findOne({ roomId });
    
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    
    return NextResponse.json({ 
      hasPassword: !!room.password,
      roomId: room.roomId 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
