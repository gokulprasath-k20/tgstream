import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';

// GET /api/users?q=searchTerm   (legacy — used by mobile / quick DM start)
// Also supports ?q=@tg_XXXXXX for TG ID lookup
// Phone is NEVER returned.
export async function GET(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { searchParams } = new URL(req.url);
    let q = searchParams.get('q')?.trim();

    const baseFilter = { _id: { $ne: user.id } };
    let dbQuery;

    if (q) {
      // Strip @ prefix for TG ID search
      const raw = q.startsWith('@') ? q.slice(1) : q;
      if (/^tg_[A-Z2-9]{6}$/i.test(raw)) {
        // Exact TG ID match
        dbQuery = { ...baseFilter, tgId: { $regex: new RegExp(`^${raw}$`, 'i') } };
      } else {
        // Username partial match
        dbQuery = { ...baseFilter, username: { $regex: q, $options: 'i' } };
      }
    } else {
      dbQuery = baseFilter;
    }

    const users = await User.find(dbQuery)
      .select('username tgId bio _id publicKey')  // phone excluded
      .limit(20)
      .lean();

    return NextResponse.json({ users });
  } catch (err) {
    console.error('[GET /api/users]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
