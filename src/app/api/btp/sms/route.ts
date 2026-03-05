import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { createBtpSms, getBtpSmsMessages } from '@/lib/btp-supabase';
import { BTP_TEST_ACCOUNTS } from '@/types/btp';

export async function GET(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const testAccountId = req.nextUrl.searchParams.get('testAccountId') || undefined;
    const messages = await getBtpSmsMessages(testAccountId);

    return NextResponse.json({ success: true, data: messages });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { testAccountId, body } = await req.json();
    if (!testAccountId || !body) {
      return NextResponse.json({ success: false, error: 'testAccountId and body required' }, { status: 400 });
    }

    const account = BTP_TEST_ACCOUNTS.find(a => a.id === testAccountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Invalid test account' }, { status: 400 });
    }

    // Send SMS via Twilio (if configured)
    let twilioSid: string | null = null;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const btpNumber = process.env.BTP_TWILIO_TEST_NUMBER;

    if (accountSid && authToken && btpNumber) {
      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);
      try {
        const msg = await client.messages.create({
          body,
          from: btpNumber,
          to: account.phone,
        });
        twilioSid = msg.sid;
      } catch (err: any) {
        console.warn('BTP SMS send failed (Twilio):', err.message);
        // Still log to DB even if Twilio fails (test numbers may not be real)
      }
    }

    // Log to BTP table
    const smsRecord = await createBtpSms({
      test_account_id: testAccountId,
      direction: 'outbound',
      from_number: btpNumber || '+15550000',
      to_number: account.phone,
      body,
      twilio_sid: twilioSid,
    });

    return NextResponse.json({ success: true, data: smsRecord });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
