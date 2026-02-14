import { NextResponse } from 'next/server';
import type { DashboardState, SubAgent, ActivityItem, BriStatus } from '@/types/dashboard';

// OpenClaw Gateway connection config
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3033';
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

async function fetchFromGateway(endpoint: string) {
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    if (!response.ok) {
      console.error(`Gateway error: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Gateway fetch error:', error);
    return null;
  }
}

export async function GET() {
  const now = new Date().toISOString();
  
  // Fetch sessions from OpenClaw gateway
  const sessionsData = await fetchFromGateway('/api/sessions');
  const sessions = sessionsData?.sessions || [];
  
  // Find main session (Bri)
  const mainSession = sessions.find((s: Record<string, unknown>) => s.kind === 'main') || sessions[0];
  
  // Extract sub-agents (isolated sessions)
  const subAgentSessions = sessions.filter((s: Record<string, unknown>) => 
    s.kind === 'isolated' || s.kind === 'subagent'
  );
  
  // Build Bri status
  const briStatus: BriStatus = {
    status: mainSession?.state === 'running' ? 'active' : 
            mainSession?.state === 'thinking' ? 'thinking' : 'idle',
    currentTask: mainSession?.lastMessage?.slice(0, 100),
    model: mainSession?.model || 'claude-opus-4-5',
    sessionKey: mainSession?.sessionKey || 'main',
    uptime: mainSession?.createdAt 
      ? Math.floor((Date.now() - new Date(mainSession.createdAt).getTime()) / 1000)
      : 0,
    lastActivity: mainSession?.lastActivityAt || now,
  };
  
  // Build sub-agents list
  const subAgents: SubAgent[] = subAgentSessions.map((s: Record<string, unknown>) => ({
    sessionKey: s.sessionKey as string,
    label: s.label as string | undefined,
    status: s.state === 'running' ? 'running' : 
            s.state === 'completed' ? 'completed' : 
            s.state === 'failed' ? 'failed' : 'idle',
    task: (s.task as string | undefined) || (s.lastMessage as string | undefined)?.slice(0, 100),
    startedAt: s.createdAt as string || now,
    completedAt: s.completedAt as string | undefined,
    model: s.model as string | undefined,
  }));
  
  // Build recent activity from session history
  const recentActivity: ActivityItem[] = [];
  
  // Add main session messages as activity
  if (mainSession?.messages) {
    const messages = (mainSession.messages as Array<Record<string, unknown>>).slice(-20);
    messages.forEach((msg: Record<string, unknown>, idx: number) => {
      recentActivity.push({
        id: `msg-${mainSession.sessionKey}-${idx}`,
        type: msg.role === 'assistant' ? 'task' : 'message',
        description: ((msg.content as string) || '').slice(0, 150),
        timestamp: (msg.timestamp as string) || now,
        status: 'success',
      });
    });
  }
  
  // Add sub-agent spawns as activity
  subAgents.forEach((agent) => {
    recentActivity.push({
      id: `spawn-${agent.sessionKey}`,
      type: 'subagent',
      description: `Sub-agent spawned: ${agent.label || agent.sessionKey}`,
      timestamp: agent.startedAt,
      status: agent.status === 'running' ? 'pending' : 
              agent.status === 'completed' ? 'success' : 
              agent.status === 'failed' ? 'error' : 'info',
    });
  });
  
  // Sort by timestamp descending
  recentActivity.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const dashboardState: DashboardState = {
    bri: briStatus,
    subAgents,
    recentActivity: recentActivity.slice(0, 50),
    stats: {
      totalTasks24h: recentActivity.filter(a => 
        new Date(a.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      activeSubAgents: subAgents.filter(s => s.status === 'running').length,
      avgResponseTime: 1200, // TODO: Calculate from actual metrics
    },
    lastUpdated: now,
  };
  
  return NextResponse.json(dashboardState);
}
