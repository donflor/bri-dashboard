import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

/**
 * Proxy route to the OpenClaw gateway API server.
 * When deployed on Vercel, the gateway at 159.65.107.113:3034 isn't directly
 * accessible from the browser, so this route proxies requests.
 * 
 * Usage: /api/gateway?endpoint=/api/status
 *        /api/gateway?endpoint=/api/metrics
 *        /api/gateway?endpoint=/health
 */
export async function GET(request: NextRequest) {
  if (!DASHBOARD_API_URL) {
    return NextResponse.json(
      { error: 'DASHBOARD_API_URL not configured', hint: 'Set DASHBOARD_API_URL env var to your API server (e.g. http://159.65.107.113:3034)' },
      { status: 503 }
    );
  }

  const endpoint = request.nextUrl.searchParams.get('endpoint') || '/api/status';
  
  try {
    const response = await fetch(`${DASHBOARD_API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${DASHBOARD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gateway returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to connect to gateway', details: message },
      { status: 502 }
    );
  }
}
