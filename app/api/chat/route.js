import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Message from '@/models/Message';
import { getAuthUser } from '@/lib/auth';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');
    
    await dbConnect();
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(50);
      
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { roomId, message, timestamp } = await req.json();

    const newMessage = await Message.create({
      roomId,
      senderId: user.id,
      username: user.username,
      text: message,
      timestamp,
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Save message error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
