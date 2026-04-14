import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET;

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
  });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const getAuthUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  return decoded;
};
