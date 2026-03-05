import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { createBtpEmail, getBtpEmails } from '@/lib/btp-supabase';
import { BTP_TEST_ACCOUNTS } from '@/types/btp';

export async function GET(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const testAccountId = req.nextUrl.searchParams.get('testAccountId') || undefined;
    const emails = await getBtpEmails(testAccountId);

    return NextResponse.json({ success: true, data: emails });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { testAccountId, subject, body } = await req.json();
    if (!testAccountId || !subject || !body) {
      return NextResponse.json({ success: false, error: 'testAccountId, subject, and body required' }, { status: 400 });
    }

    const account = BTP_TEST_ACCOUNTS.find(a => a.id === testAccountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Invalid test account' }, { status: 400 });
    }

    // Send email via Postmark (if configured)
    const postmarkToken = process.env.POSTMARK_SERVER_TOKEN;
    if (postmarkToken) {
      try {
        await fetch('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': postmarkToken,
          },
          body: JSON.stringify({
            From: 'btp@bizrnr.com',
            To: account.email,
            Subject: `[BTP] ${subject}`,
            TextBody: body,
            Tag: 'btp-test',
          }),
        });
      } catch (err: any) {
        console.warn('BTP email send failed (Postmark):', err.message);
      }
    }

    // Log to BTP table
    const emailRecord = await createBtpEmail({
      test_account_id: testAccountId,
      direction: 'outbound',
      from_email: 'btp@bizrnr.com',
      to_email: account.email,
      subject,
      body,
    });

    return NextResponse.json({ success: true, data: emailRecord });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
