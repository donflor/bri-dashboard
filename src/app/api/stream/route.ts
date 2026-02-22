import { NextRequest } from 'next/server';
import type { DashboardState } from '@/types/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

async function fetchFromExternalAPI(): Promise<DashboardState | null> {
  if (!DASHBOARD_API_URL) return null;
  try {
    const response = await fetch(`${DASHBOARD_API_URL}/api/status`, {
      headers: {
        'Authorization': `Bearer ${DASHBOARD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return await response.json();
  } catch (error) {
    console.error('External API error:', error instanceof Error ? error.message : error);
  }
  return null;
}

async function fetchFromRealStatus(): Promise<DashboardState | null> {
  try {
    const { GET } = await import('../real-status/route');
    const response = await GET();
    if (response.ok) return await response.json();
  } catch (error) {
    console.error('Real status fetch error:', error);
  }
  return null;
}

async function fetchStatus(): Promise<DashboardState | null> {
  // Try both sources in parallel, prefer external API (has session/cron data)
  const [externalData, realStatusData] = await Promise.all([
    fetchFromExternalAPI(),
    fetchFromRealStatus(),
  ]);

  // If we have external API data, merge with real-status enrichments
  if (externalData) {
    if (realStatusData) {
      // Merge: external has session/cron data, real-status has CRM/Twilio/Instantly
      const mergedActivities = [
        ...externalData.recentActivity,
        ...realStatusData.recentActivity.filter(a => 
          !externalData.recentActivity.some(ea => ea.id === a.id)
        ),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
      
      return {
        ...externalData,
        recentActivity: mergedActivities,
        stats: {
          ...externalData.stats,
          totalTasks24h: Math.max(externalData.stats.totalTasks24h, realStatusData.stats.totalTasks24h),
          tokenUsage: realStatusData.stats.tokenUsage,
        },
        _sources: { external: true, realStatus: true },
      } as DashboardState;
    }
    return { ...externalData, _sources: { external: true } } as DashboardState;
  }

  // Fall back to real-status only
  if (realStatusData) {
    return { ...realStatusData, _sources: { realStatus: true } } as DashboardState;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const status = await fetchStatus();
      if (status) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`));
      }

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        try {
          const status = await fetchStatus();
          if (status) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(status)}\n\n`));
          }
        } catch (e) {
          console.error('Stream error:', e);
        }
      }, 2000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
