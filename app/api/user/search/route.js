import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { isValidTgId } from '@/lib/tgId';

/**
 * GET /api/user/search?q=tg_A7K9X2   — search by exact TG ID
 * GET /api/user/search?q=john         — search by username (partial, case-insensitive)
 * GET /api/user/search?q=@tg_A7K9X2  — @ prefix accepted
 *
 * NEVER returns: phone, password, blockedUsers, contactRequests, sentRequests
 */
export async function GET(req) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const { searchParams } = new URL(req.url);
    let q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    // Strip leading @ for TG ID
    if (q.startsWith('@')) q = q.slice(1);

    const isTgSearch = isValidTgId(q);

    let dbQuery;
    if (isTgSearch) {
      // Exact TG ID lookup (case-insensitive)
      dbQuery = { tgId: { $regex: new RegExp(`^${q}$`, 'i') }, _id: { $ne: user.id } };
    } else {
      // Partial username search
      dbQuery = {
        username: { $regex: q, $options: 'i' },
        _id:      { $ne: user.id },
      };
    }

    const users = await User.find(dbQuery)
      // PUBLIC fields ONLY — phone is explicitly excluded
      .select('username tgId bio publicKey _id chatPrivacy')
      .limit(isTgSearch ? 1 : 15)
      .lean();

    // Strip chatPrivacy from response (internal use only)
    const safe = users.map(({ chatPrivacy, ...rest }) => rest);

    return NextResponse.json({ users: safe, type: isTgSearch ? 'tgid' : 'username' });
  } catch (err) {
    console.error('[GET /api/user/search]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
