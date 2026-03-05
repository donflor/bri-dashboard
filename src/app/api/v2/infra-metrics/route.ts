import { NextResponse } from 'next/server';

// Proxy to the droplet API server which has access to system metrics
const API_URL = process.env.DASHBOARD_API_URL || process.env.BMC_API_URL || '';
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';

export async function GET() {
  // Try droplet API server first
  const baseUrls = [
    API_URL,
    'http://127.0.0.1:3034',
    'http://159.65.107.113:8080/bmc',
  ].filter(Boolean);

  for (const base of baseUrls) {
    try {
      const res = await fetch(`${base}/api/v2/infra-metrics`, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'Infrastructure metrics unavailable' }, { status: 503 });
}
