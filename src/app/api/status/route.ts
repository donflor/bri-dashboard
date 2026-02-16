import { NextResponse } from 'next/server';
import type { DashboardState, BriStatus } from '@/types/dashboard';

// This endpoint is not actively used - the main data comes from /api/stream
// which connects to our custom API server on port 3034

export async function GET() {
  const now = new Date().toISOString();
  
  // Return minimal state - real data comes from /api/stream
  const state: DashboardState = {
    bri: {
      status: 'idle',
      model: 'claude-opus-4-5',
      sessionKey: 'main',
      uptime: 0,
      lastActivity: now,
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
    lastUpdated: now,
  };
  
  return NextResponse.json(state);
}
