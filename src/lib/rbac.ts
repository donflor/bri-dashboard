import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Admin emails - these users get full Production + Sandbox access
const ADMIN_EMAILS = [
  'don@bizrnr.com',
  'kp@bizrnr.com',
  'admin@bizrnr.com',
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(): Promise<{ authorized: boolean; session: any; response?: NextResponse }> {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      authorized: false,
      session: null,
      response: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
    };
  }

  if (!isAdmin(session.user.email)) {
    return {
      authorized: false,
      session,
      response: NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 }),
    };
  }

  return { authorized: true, session };
}

export async function requireAuth(): Promise<{ authenticated: boolean; session: any; response?: NextResponse }> {
  const session = await auth();

  if (!session?.user?.email) {
    return {
      authenticated: false,
      session: null,
      response: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }),
    };
  }

  return { authenticated: true, session };
}
