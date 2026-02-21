import { NextRequest } from 'next/server';
import type { DashboardState } from '@/types/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';

async function fetchStatus(): Promise<DashboardState | null> {
  // Try external API first if configured
  if (DASHBOARD_API_URL) {
    try {
      const response = await fetch(`${DASHBOARD_API_URL}/api/status`, {
        headers: {
          'Authorization': `Bearer ${DASHBOARD_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (response.ok) return await response.json();
    } catch (error) {
      console.error('External API error, falling back to real-status:', error);
    }
  }
  
  // Fall back to internal real-status route
  try {
    const { GET } = await import('../real-status/route');
    const response = await GET();
    if (response.ok) return await response.json();
  } catch (error) {
    console.error('Real status fetch error:', error);
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
