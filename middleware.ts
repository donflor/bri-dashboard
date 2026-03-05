import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect all API routes except auth endpoints and the SSE stream
  // (SSE stream is read-only observability — acceptable without session cookie in some SSE clients)
  const protectedPrefixes = ['/api/v2/', '/api/admin/'];

  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  // Match API routes that need protection — skip auth routes and static assets
  matcher: ['/api/v2/:path*', '/api/admin/:path*'],
};
