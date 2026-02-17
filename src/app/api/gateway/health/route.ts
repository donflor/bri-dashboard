import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

/**
 * Health check that validates connectivity to the gateway API server.
 * Returns system health indicators.
 */
export async function GET() {
  const health = {
    dashboard: 'ok' as const,
    gateway: 'disconnected' as 'connected' | 'disconnected' | 'error',
    apiServer: 'disconnected' as 'connected' | 'disconnected' | 'error',
    gatewayUrl: DASHBOARD_API_URL ? '***configured***' : 'not configured',
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage ? {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    } : undefined,
  };

  if (DASHBOARD_API_URL) {
    try {
      const res = await fetch(`${DASHBOARD_API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      health.apiServer = res.ok ? 'connected' : 'error';
    } catch {
      health.apiServer = 'disconnected';
    }

    try {
      const res = await fetch(`${DASHBOARD_API_URL}/api/status`, {
        headers: { 'Authorization': `Bearer ${DASHBOARD_API_TOKEN}` },
        signal: AbortSignal.timeout(5000),
      });
      health.gateway = res.ok ? 'connected' : 'error';
    } catch {
      health.gateway = 'disconnected';
    }
  }

  return NextResponse.json(health);
}
