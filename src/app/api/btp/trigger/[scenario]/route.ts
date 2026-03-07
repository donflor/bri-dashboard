import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import {
  createBtpSession,
  updateBtpSession,
  createBtpEmail,
  createBtpSms,
  createBtpCallLog,
} from '@/lib/btp-supabase';
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

    // Create session with pending status
    const session = await createBtpSession(testAccountId, scenario as BtpScenario, {
      triggered_by: 'test_playbook',
      account_name: account.name,
      account_phone: account.phone,
      account_email: account.email,
    });

    // Update to running
    await updateBtpSession(session.id, { status: 'running' });

    // Dispatch scenario asynchronously — inserts real test data
    dispatchScenario(scenario as BtpScenario, account, session.id, testAccountId).catch(err => {
      console.error(`BTP scenario ${scenario} failed:`, err);
      updateBtpSession(session.id, {
        status: 'failed',
        ended_at: new Date().toISOString(),
        metadata: { ...session.metadata, error: err.message },
      }).catch(() => {});
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
  sessionId: string,
  testAccountId: string,
) {
  const btpNumber = process.env.BTP_TWILIO_TEST_NUMBER || '+15559999999';
  const btpEmail = 'btp@bizrnr.com';

  switch (scenario) {
    case 'magic-demo': {
      await createBtpEmail({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_email: btpEmail,
        to_email: account.email,
        subject: 'Welcome to BizRnR — Your Magic Demo is Ready! ✨',
        body: `Hi ${account.name},\n\nYour personalized AI voice demo is ready to experience. Click below to hear how BizRnR can handle your inbound calls with a custom-trained voice agent.\n\n🎙️ Play Your Demo: https://demo.bizrnr.com/magic/${testAccountId}\n\nThis demo was generated in under 45 seconds using your business info.\n\nBest,\nBizRnR Team`,
      });
      await sleep(1500);
      await createBtpEmail({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_email: btpEmail,
        to_email: account.email,
        subject: "Your free trial is active — here's what happens next",
        body: `Hi ${account.name},\n\nYour BizRnR free trial is now active! Here's your setup:\n\n✅ Custom voice agent trained\n✅ Forwarding number assigned\n✅ Call analytics dashboard live\n\nYour trial runs for 7 days. We'll check in at day 3 to see how it's going.\n\nBest,\nBizRnR Team`,
      });
      break;
    }

    case 'winback-sms': {
      await createBtpSms({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_number: btpNumber,
        to_number: account.phone,
        body: `Hey ${account.name}! Your BizRnR free trial expired yesterday. We saved your custom voice agent setup — reply YES to reactivate for 48 more hours, or UPGRADE to lock in the rate.`,
        twilio_sid: `BTP_SIM_${Date.now()}`,
      });
      await sleep(1000);
      await createBtpSms({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_number: btpNumber,
        to_number: account.phone,
        body: `⏰ Just a heads up — your saved voice agent config will be deleted in 24 hours. Reply UPGRADE to keep it, or call us at (555) 123-4567.`,
        twilio_sid: `BTP_SIM_${Date.now()}`,
      });
      break;
    }

    case 'winback-call': {
      await createBtpCallLog({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_number: btpNumber,
        to_number: account.phone,
        duration_seconds: 47,
        recording_url: null,
        twilio_sid: `BTP_SIM_CALL_${Date.now()}`,
      });
      await sleep(1000);
      await createBtpSms({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_number: btpNumber,
        to_number: account.phone,
        body: `Hi ${account.name}, just tried calling about your BizRnR trial. Your AI voice agent handled 12 calls during the trial! Want to keep it running? Reply UPGRADE or visit bizrnr.com/upgrade`,
        twilio_sid: `BTP_SIM_${Date.now()}`,
      });
      break;
    }

    case 'inbound-call': {
      await createBtpCallLog({
        test_account_id: testAccountId,
        direction: 'inbound',
        from_number: account.phone,
        to_number: btpNumber,
        duration_seconds: 124,
        recording_url: null,
        twilio_sid: `BTP_SIM_INBOUND_${Date.now()}`,
      });
      break;
    }

    case 'sms-reply': {
      await createBtpSms({
        test_account_id: testAccountId,
        direction: 'inbound',
        from_number: account.phone,
        to_number: btpNumber,
        body: "YES I'm interested! How much is it after the trial?",
        twilio_sid: `BTP_SIM_INBOUND_${Date.now()}`,
      });
      break;
    }

    case 'email-reply': {
      await createBtpEmail({
        test_account_id: testAccountId,
        direction: 'inbound',
        from_email: account.email,
        to_email: btpEmail,
        subject: 'Re: Your free trial is active',
        body: `Hi,\n\nI've been testing the voice agent and it's working great for my business. What plans do you offer after the trial ends?\n\nThanks,\n${account.name}`,
      });
      break;
    }

    case 'enterprise-escalation': {
      await createBtpEmail({
        test_account_id: testAccountId,
        direction: 'inbound',
        from_email: account.email,
        to_email: btpEmail,
        subject: 'Enterprise inquiry — 50+ locations',
        body: `Hello BizRnR team,\n\nI manage operations for a franchise with 50+ locations. We need an AI voice solution for all our locations. Can we schedule a call to discuss enterprise pricing?\n\nBest,\n${account.name}\nVP of Operations`,
      });
      await sleep(1000);
      await createBtpCallLog({
        test_account_id: testAccountId,
        direction: 'inbound',
        from_number: account.phone,
        to_number: btpNumber,
        duration_seconds: 312,
        recording_url: null,
        twilio_sid: `BTP_SIM_ENTERPRISE_${Date.now()}`,
      });
      await sleep(500);
      await createBtpEmail({
        test_account_id: testAccountId,
        direction: 'outbound',
        from_email: btpEmail,
        to_email: account.email,
        subject: 'Re: Enterprise inquiry — 50+ locations',
        body: `Hi ${account.name},\n\nThank you for reaching out! For enterprise accounts with 50+ locations, we offer custom volume pricing and dedicated onboarding.\n\nI've escalated your request to our Enterprise team. They'll reach out within 2 hours to schedule a discovery call.\n\nBest,\nBizRnR Enterprise Team`,
      });
      break;
    }
  }

  // Mark session as completed
  await updateBtpSession(sessionId, {
    status: 'success',
    ended_at: new Date().toISOString(),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
