import { NextRequest } from 'next/server';
import type { DashboardState, SubAgent, ActivityItem } from '@/types/dashboard';

// Use Node.js runtime to allow HTTP requests to our API server
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow streaming for up to 60 seconds

// Dashboard API server (runs on same server as OpenClaw)
const DASHBOARD_API_URL = process.env.DASHBOARD_API_URL || '';
const DASHBOARD_API_TOKEN = process.env.DASHBOARD_API_TOKEN || '';
const DEMO_MODE = !DASHBOARD_API_URL || DASHBOARD_API_URL === '';

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
    const response = await fetch(`${DASHBOARD_API_URL}/api/status`, {
      headers: {
        'Authorization': `Bearer ${DASHBOARD_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error('Dashboard API error:', response.status);
      return generateDemoState();
    }
    
    const data = await response.json();
    return data as DashboardState;
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
