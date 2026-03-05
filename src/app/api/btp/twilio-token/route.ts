import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import twilio from 'twilio';

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await requireAdmin();
    if (!authorized) return response!;

    const { testAccountId } = await req.json();

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !authToken || !twimlAppSid) {
      return NextResponse.json(
        { success: false, error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    const identity = `btp_${testAccountId}_${Date.now()}`;

    // Generate AccessToken for WebRTC Voice
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const token = new AccessToken(accountSid, process.env.TWILIO_API_KEY || accountSid, process.env.TWILIO_API_SECRET || authToken, { identity });

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });
    token.addGrant(voiceGrant);

    return NextResponse.json({
      success: true,
      data: { token: token.toJwt(), identity },
    });
  } catch (error: any) {
    console.error('BTP twilio-token error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
