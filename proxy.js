import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function proxy(request) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const publicPaths = ['/', '/login', '/signup', '/api/auth/login', '/api/auth/signup'];
  
  // Allow static files and public paths
  if (
    pathname.startsWith('/_next') || 
    pathname.includes('.') || 
    publicPaths.includes(pathname)
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/room/:path*',
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
