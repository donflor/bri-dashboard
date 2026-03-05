import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { createBtpSession, getBtpSessions } from '@/lib/btp-supabase';

export async function GET() {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const sessions = await getBtpSessions();
    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { testAccountId, scenario, metadata } = await req.json();
    if (!testAccountId || !scenario) {
      return NextResponse.json({ success: false, error: 'testAccountId and scenario required' }, { status: 400 });
    }

    const session = await createBtpSession(testAccountId, scenario, metadata || {});
    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
