import { NextRequest } from 'next/server';
import type { DashboardState, SubAgent, ActivityItem } from '@/types/dashboard';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL;
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const DEMO_MODE = !OPENCLAW_GATEWAY || OPENCLAW_GATEWAY === '';

// Demo data generator for when gateway isn't connected
function generateDemoState(): DashboardState {
  const now = new Date().toISOString();
  const statuses = ['active', 'thinking', 'idle'] as const;
  const randomStatus = statuses[Math.floor(Math.random() * 3)];
  
  const tasks = [
    'Researching competitor pricing strategies...',
    'Analyzing email campaign performance...',
    'Generating lead qualification report...',
    'Checking calendar for upcoming meetings...',
    'Processing inbound lead from Apollo...',
    'Drafting follow-up email sequence...',
  ];
  
  const demoSubAgents: SubAgent[] = [
    {
      sessionKey: 'demo-email-campaign',
      label: 'email-campaign',
      status: 'running',
      task: 'Sending batch 3/5 of cold outreach emails',
      startedAt: new Date(Date.now() - 300000).toISOString(),
      model: 'claude-sonnet-4',
    },
    {
      sessionKey: 'demo-lead-research',
      label: 'lead-research',
      status: 'completed',
      task: 'Researched 50 dental practices in Dallas area',
      startedAt: new Date(Date.now() - 900000).toISOString(),
      completedAt: new Date(Date.now() - 600000).toISOString(),
      model: 'claude-sonnet-4',
    },
  ];
  
  const demoActivities: ActivityItem[] = [
    {
      id: 'act-1',
      type: 'task',
      description: 'Daily analytics report generated and posted to #analytics',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      status: 'success',
      duration: 8500,
    },
    {
      id: 'act-2',
      type: 'subagent',
      description: 'Sub-agent spawned: email-campaign',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      status: 'pending',
    },
    {
      id: 'act-3',
      type: 'message',
      description: 'Responded to KP in #bri about dashboard MVP',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      status: 'success',
      duration: 12300,
    },
    {
      id: 'act-4',
      type: 'task',
      description: 'Fetched 47 new leads from Apollo for HVAC category',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'success',
      duration: 4200,
    },
    {
      id: 'act-5',
      type: 'system',
      description: 'Heartbeat check completed - inbox clear',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'info',
    },
  ];
  
  return {
    bri: {
      status: randomStatus,
      currentTask: randomStatus === 'active' ? tasks[Math.floor(Math.random() * tasks.length)] : undefined,
      model: 'claude-opus-4-5',
      sessionKey: 'main',
      uptime: Math.floor((Date.now() - new Date('2026-02-14T08:00:00Z').getTime()) / 1000),
      lastActivity: new Date(Date.now() - 60000).toISOString(),
    },
    subAgents: demoSubAgents,
    recentActivity: demoActivities,
    stats: {
      totalTasks24h: 47,
      activeSubAgents: 1,
      avgResponseTime: 2100,
    },
    lastUpdated: now,
  };
}

async function fetchStatus(): Promise<DashboardState | null> {
  if (DEMO_MODE) {
    return generateDemoState();
  }
  
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) return generateDemoState();
    
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
    return generateDemoState();
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
            // In demo mode, always send updates to show "live" feel
            if (newState !== lastState || DEMO_MODE) {
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
