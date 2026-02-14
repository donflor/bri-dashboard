import { NextRequest } from 'next/server';
import type { DashboardState } from '@/types/dashboard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3033';
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

async function fetchStatus(): Promise<DashboardState | null> {
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const sessions = data.sessions || [];
    const now = new Date().toISOString();
    
    const mainSession = sessions.find((s: Record<string, unknown>) => s.kind === 'main') || sessions[0];
    const subAgentSessions = sessions.filter((s: Record<string, unknown>) => 
      s.kind === 'isolated' || s.kind === 'subagent'
    );
    
    return {
      bri: {
        status: mainSession?.state === 'running' ? 'active' : 
                mainSession?.state === 'thinking' ? 'thinking' : 'idle',
        currentTask: mainSession?.lastMessage?.slice(0, 100),
        model: mainSession?.model || 'claude-opus-4-5',
        sessionKey: mainSession?.sessionKey || 'main',
        uptime: mainSession?.createdAt 
          ? Math.floor((Date.now() - new Date(mainSession.createdAt).getTime()) / 1000)
          : 0,
        lastActivity: mainSession?.lastActivityAt || now,
      },
      subAgents: subAgentSessions.map((s: Record<string, unknown>) => ({
        sessionKey: s.sessionKey as string,
        label: s.label as string | undefined,
        status: s.state === 'running' ? 'running' as const : 
                s.state === 'completed' ? 'completed' as const : 
                s.state === 'failed' ? 'failed' as const : 'idle' as const,
        task: (s.task as string | undefined) || (s.lastMessage as string | undefined)?.slice(0, 100),
        startedAt: (s.createdAt as string) || now,
        completedAt: s.completedAt as string | undefined,
        model: s.model as string | undefined,
      })),
      recentActivity: [],
      stats: {
        totalTasks24h: 0,
        activeSubAgents: subAgentSessions.filter((s: Record<string, unknown>) => s.state === 'running').length,
        avgResponseTime: 1200,
      },
      lastUpdated: now,
    };
  } catch (error) {
    console.error('Status fetch error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let lastState = '';

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state
      const status = await fetchStatus();
      if (status) {
        lastState = JSON.stringify(status);
        controller.enqueue(encoder.encode(`data: ${lastState}\n\n`));
      }

      // Poll every 2 seconds
      const interval = setInterval(async () => {
        try {
          const status = await fetchStatus();
          if (status) {
            const newState = JSON.stringify(status);
            if (newState !== lastState) {
              lastState = newState;
              controller.enqueue(encoder.encode(`data: ${newState}\n\n`));
            }
          }
        } catch (e) {
          console.error('Stream error:', e);
        }
      }, 2000);

      // Clean up on close
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
