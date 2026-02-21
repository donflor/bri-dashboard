import { NextResponse } from 'next/server';
import type { DashboardState, CronJob, SubAgent, ActivityItem } from '@/types/dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache
let cachedData: DashboardState | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30s

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const INSTANTLY_KEY = process.env.INSTANTLY_API_KEY || '';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';

async function safeFetch<T>(url: string, opts: RequestInit = {}, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function fetchSupabase<T>(table: string, query: string, fallback: T): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback;
  return safeFetch(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    fallback
  );
}

async function fetchCronJobs(): Promise<CronJob[]> {
  // OpenClaw cron data is fetched via the gateway API if configured,
  // otherwise we use env-injected snapshot data
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!gatewayUrl) return [];
  
  const data = await safeFetch<{ jobs?: any[] }>(
    `${gatewayUrl}/api/cron/list`,
    { headers: gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {} },
    { jobs: [] }
  );
  
  return (data.jobs || []).map((j: any) => ({
    id: j.id,
    name: j.name || j.id,
    schedule: j.schedule?.expr || (j.schedule?.everyMs ? `every ${Math.round(j.schedule.everyMs / 60000)}m` : '—'),
    lastRun: j.state?.lastRunAtMs ? new Date(j.state.lastRunAtMs).toISOString() : '—',
    nextRun: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : undefined,
    status: j.state?.lastStatus === 'ok' ? 'completed' as const : j.state?.lastStatus === 'error' ? 'error' as const : 'scheduled' as const,
    result: j.state?.lastStatus || undefined,
    sessionKey: j.id,
  }));
}

async function fetchSubAgents(): Promise<SubAgent[]> {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!gatewayUrl) return [];

  const data = await safeFetch<{ sessions?: any[] }>(
    `${gatewayUrl}/api/sessions/list`,
    { headers: gatewayToken ? { Authorization: `Bearer ${gatewayToken}` } : {} },
    { sessions: [] }
  );

  return (data.sessions || [])
    .filter((s: any) => s.key?.includes('subagent'))
    .slice(0, 20)
    .map((s: any) => ({
      sessionKey: s.key,
      label: s.key.split(':').pop() || s.key,
      status: s.ageMs < 120_000 ? 'running' as const : 'completed' as const,
      task: s.model || undefined,
      startedAt: new Date(s.updatedAt - (s.ageMs || 0)).toISOString(),
      model: s.model,
    }));
}

async function fetchTwilioCalls(): Promise<any[]> {
  if (!TWILIO_SID || !TWILIO_TOKEN) return [];
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const data = await safeFetch<{ calls?: any[] }>(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json?PageSize=20`,
    { headers: { Authorization: `Basic ${auth}` } },
    { calls: [] }
  );
  return data.calls || [];
}

async function fetchInstantlyCampaigns(): Promise<any[]> {
  if (!INSTANTLY_KEY) return [];
  const data = await safeFetch<{ items?: any[] }>(
    'https://api.instantly.ai/api/v2/campaigns?limit=10',
    { headers: { Authorization: `Bearer ${INSTANTLY_KEY}` } },
    { items: [] }
  );
  return data.items || [];
}

async function fetchInstantlyAnalytics(campaignIds: string[]): Promise<any[]> {
  if (!INSTANTLY_KEY || campaignIds.length === 0) return [];
  const ids = campaignIds.map(id => `id=${id}`).join('&');
  return safeFetch<any[]>(
    `https://api.instantly.ai/api/v2/campaigns/analytics?${ids}`,
    { headers: { Authorization: `Bearer ${INSTANTLY_KEY}` } },
    []
  );
}

async function buildDashboardState(): Promise<DashboardState> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000).toISOString();

  // Parallel fetch all sources
  const [
    crmActivities,
    crmLeads,
    twilioCalls,
    campaigns,
    cronJobs,
    subAgents,
  ] = await Promise.all([
    fetchSupabase<any[]>('crm_activities', `select=id,type,title,description,created_at,outcome&order=created_at.desc&limit=30`, []),
    fetchSupabase<any[]>('crm_leads', `select=id,created_at&created_at=gte.${yesterday}`, []),
    fetchTwilioCalls(),
    fetchInstantlyCampaigns(),
    fetchCronJobs(),
    fetchSubAgents(),
  ]);

  // Get campaign analytics
  const campaignIds = campaigns.map((c: any) => c.id);
  const analytics = await fetchInstantlyAnalytics(campaignIds);

  // Build activity feed from real sources
  const recentActivity: ActivityItem[] = [];

  // CRM activities
  for (const a of crmActivities.slice(0, 15)) {
    recentActivity.push({
      id: a.id,
      type: a.type === 'email' ? 'message' : a.type === 'call' ? 'task' : 'system',
      description: a.title || a.description || 'CRM Activity',
      timestamp: a.created_at,
      status: a.outcome === 'error' ? 'error' : 'success',
      metadata: { source: 'supabase_crm' },
    });
  }

  // Twilio calls
  for (const c of twilioCalls.slice(0, 10)) {
    recentActivity.push({
      id: c.sid,
      type: 'incoming',
      description: `${c.direction} call ${c.direction === 'inbound' ? 'from' : 'to'} ${c.from_formatted || c.from} (${c.duration}s)`,
      timestamp: new Date(c.date_created).toISOString(),
      status: c.status === 'completed' ? 'success' : c.status === 'failed' ? 'error' : 'info',
      duration: parseInt(c.duration || '0') * 1000,
      metadata: { source: 'twilio', direction: c.direction },
    });
  }

  // Sort by timestamp desc
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Stats
  const totalEmailsSent = analytics.reduce((sum: number, a: any) => sum + (a.emails_sent_count || 0), 0);
  const totalLeads = analytics.reduce((sum: number, a: any) => sum + (a.leads_count || 0), 0);
  const activeCrons = cronJobs.filter(j => j.status !== 'error').length;
  const activeAgents = subAgents.filter(a => a.status === 'running').length;

  // Calculate avg response from cron durations
  const cronDurations = cronJobs
    .map(j => j.result)
    .filter(Boolean);

  return {
    bri: {
      status: 'active',
      currentTask: subAgents.find(a => a.status === 'running')?.task || undefined,
      model: 'claude-opus-4-6',
      sessionKey: 'main',
      uptime: Math.floor((now.getTime() - new Date('2026-02-20T00:00:00Z').getTime()) / 1000),
      lastActivity: recentActivity[0]?.timestamp || now.toISOString(),
    },
    cronJobs,
    subAgents,
    recentActivity: recentActivity.slice(0, 50),
    stats: {
      totalTasks24h: crmActivities.filter((a: any) => new Date(a.created_at) > new Date(yesterday)).length + twilioCalls.length,
      activeSubAgents: activeAgents,
      activeCronJobs: activeCrons,
      avgResponseTime: 1200, // Will be replaced when we have real metrics
      tokenUsage: totalEmailsSent,
      estimatedCost: undefined,
      errorRate: crmActivities.filter((a: any) => a.outcome === 'error').length / Math.max(crmActivities.length, 1),
    },
    lastUpdated: now.toISOString(),
  };
}

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedData);
  }

  try {
    cachedData = await buildDashboardState();
    cacheTime = now;
    return NextResponse.json(cachedData);
  } catch (error) {
    console.error('Real status error:', error);
    return NextResponse.json({ error: 'Failed to fetch real data' }, { status: 500 });
  }
}
