import { NextRequest } from 'next/server';
import type { DashboardState } from '@/types/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

async function fetchStatus(): Promise<DashboardState | null> {
  if (!DASHBOARD_API_URL) {
    // Return empty state if no API configured
    return {
      bri: {
        status: 'offline',
        model: 'claude-opus-4-5',
        sessionKey: 'main',
        uptime: 0,
        lastActivity: new Date().toISOString(),
      },
      cronJobs: [],
      subAgents: [],
      recentActivity: [],
      stats: {
        totalTasks24h: 0,
        activeSubAgents: 0,
        activeCronJobs: 0,
        avgResponseTime: 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
  
  try {
    const response = await fetch(`${DASHBOARD_API_URL}/api/status`, {
      headers: {
        'Authorization': `Bearer ${DASHBOARD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('Dashboard API error:', response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Status fetch error:', error);
    return null;
  }
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
