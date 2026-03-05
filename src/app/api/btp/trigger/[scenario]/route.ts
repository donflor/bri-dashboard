import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { createBtpSession, updateBtpSession } from '@/lib/btp-supabase';
import { BTP_TEST_ACCOUNTS, type BtpScenario } from '@/types/btp';

const VALID_SCENARIOS: BtpScenario[] = [
  'magic-demo', 'enterprise-escalation', 'winback-sms', 'winback-call',
  'inbound-call', 'sms-reply', 'email-reply',
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ scenario: string }> }
) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { scenario } = await params;

    if (!VALID_SCENARIOS.includes(scenario as BtpScenario)) {
      return NextResponse.json(
        { success: false, error: `Invalid scenario: ${scenario}. Valid: ${VALID_SCENARIOS.join(', ')}` },
        { status: 400 }
      );
    }

    const { testAccountId } = await req.json();
    if (!testAccountId) {
      return NextResponse.json({ success: false, error: 'testAccountId required' }, { status: 400 });
    }

    const account = BTP_TEST_ACCOUNTS.find(a => a.id === testAccountId);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Invalid test account' }, { status: 400 });
    }

    // Create session
    const session = await createBtpSession(testAccountId, scenario as BtpScenario, {
      triggered_by: 'test_playbook',
      account_name: account.name,
      account_phone: account.phone,
      account_email: account.email,
    });

    // Update to running
    await updateBtpSession(session.id, { status: 'running' });

    // Dispatch scenario (async — fire and forget, real execution happens server-side)
    dispatchScenario(scenario as BtpScenario, account, session.id).catch(err => {
      console.error(`BTP scenario ${scenario} failed:`, err);
      updateBtpSession(session.id, { status: 'failed', ended_at: new Date().toISOString() }).catch(() => {});
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      scenario,
      status: 'running',
    });
  } catch (error: any) {
    console.error('BTP trigger error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function dispatchScenario(
  scenario: BtpScenario,
  account: { name: string; phone: string; email: string },
  sessionId: string
) {
  // Each scenario dispatches to the appropriate service
  // These are stubs that will be wired to real services
  switch (scenario) {
    case 'magic-demo':
      // Trigger ElevenLabs demo flow for the test account
      console.log(`[BTP] Magic Demo triggered for ${account.name} (${account.phone})`);
      break;

    case 'enterprise-escalation':
      // Simulate enterprise-tier lead escalation
      console.log(`[BTP] Enterprise Escalation triggered for ${account.name}`);
      break;

    case 'winback-sms':
      // Fire T+24h win-back SMS via Twilio
      console.log(`[BTP] Win-back SMS triggered to ${account.phone}`);
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.BTP_TWILIO_TEST_NUMBER) {
        const twilio = (await import('twilio')).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
          body: `[BTP TEST] Hey ${account.name}! Your free trial of BizRnR expired. We saved your setup — reply YES to reactivate.`,
          from: process.env.BTP_TWILIO_TEST_NUMBER,
          to: account.phone,
        });
      }
      break;

    case 'winback-call':
      // Fire T+12h win-back voice call
      console.log(`[BTP] Win-back Call triggered to ${account.phone}`);
      break;

    case 'inbound-call':
      // Simulate inbound call to test number
      console.log(`[BTP] Inbound Call simulation for ${account.phone}`);
      break;

    case 'sms-reply':
      // Simulate inbound SMS reply
      console.log(`[BTP] SMS Reply simulation from ${account.phone}`);
      break;

    case 'email-reply':
      // Simulate inbound email reply
      console.log(`[BTP] Email Reply simulation from ${account.email}`);
      break;
  }

  // Mark session as completed after dispatch
  await updateBtpSession(sessionId, {
    status: 'success',
    ended_at: new Date().toISOString(),
  });
}
