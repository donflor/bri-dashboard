import type { DashboardState, ActivityItem, CronJob, SubAgent } from '@/types/dashboard';

const TASK_NAMES = [
  'Processing Slack message from #general',
  'Sending email campaign report to Don',
  'Running CRM lead enrichment pipeline',
  'Generating weekly analytics summary',
  'Syncing Supabase contacts with Apollo',
  'Checking inbox for urgent emails',
  'Scheduling Cal.com appointments',
  'Deploying BizRnr frontend update',
  'Running n8n workflow: Lead Scoring',
  'Transcribing voicemail from +1 619-xxx',
  'Updating kanban board tasks',
  'Processing Stripe webhook: new subscription',
  'Sending LinkedIn outreach batch #42',
  'Running SEO audit on bizrnr.com',
  'Compiling daily standup summary',
  'Backing up Supabase database',
  'Processing Twilio SMS from customer',
  'Generating social media content',
  'Analyzing competitor pricing data',
  'Reviewing GitHub pull requests',
];

const CRON_NAMES = [
  'Inbox Check',
  'Calendar Sync',
  'Analytics Report',
  'Lead Enrichment',
  'Social Monitor',
  'Health Check',
  'Backup Runner',
  'Weather Brief',
];

const SOURCES = [
  { type: 'slack' as const, channel: '#general', channelType: 'channel' as const },
  { type: 'slack' as const, channel: '#bri', channelType: 'channel' as const },
  { type: 'slack' as const, channel: 'DM', channelType: 'dm' as const },
  { type: 'cron' as const },
  { type: 'subagent' as const },
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTimestamp(hoursAgo: number): string {
  const ms = Date.now() - Math.random() * hoursAgo * 3600000;
  return new Date(ms).toISOString();
}

export function generateMockActivities(count: number = 30, hours: number = 24): ActivityItem[] {
  const types: ActivityItem['type'][] = ['task', 'message', 'subagent', 'cron', 'incoming', 'system'];
  const statuses: ActivityItem['status'][] = ['success', 'completed', 'info', 'error', 'pending', 'in_progress'];

  return Array.from({ length: count }, (_, i) => {
    const type = randomFrom(types);
    const status = i < 2 ? randomFrom(['pending', 'in_progress', 'running'] as ActivityItem['status'][]) : randomFrom(statuses);
    const source = randomFrom(SOURCES);
    return {
      id: `mock-${i}-${Date.now()}`,
      type,
      description: randomFrom(TASK_NAMES),
      timestamp: generateTimestamp(hours),
      status,
      duration: status === 'pending' ? undefined : randomBetween(200, 15000),
      source,
      sourceDisplay: source.channel || source.type,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateMockCronJobs(): CronJob[] {
  return CRON_NAMES.slice(0, randomBetween(4, 7)).map((name, i) => ({
    id: `cron-${i}`,
    name,
    lastRun: generateTimestamp(4),
    status: i === 0 ? 'running' : randomFrom(['completed', 'completed', 'completed', 'error', 'scheduled'] as CronJob['status'][]),
    result: i === 0 ? undefined : `Processed ${randomBetween(5, 200)} items`,
  }));
}

export function generateMockSubAgents(): SubAgent[] {
  const labels = ['Email Campaign Runner', 'Lead Enrichment Worker', 'Content Generator', 'Data Sync Agent'];
  const count = randomBetween(1, 3);
  return labels.slice(0, count).map((label, i) => ({
    sessionKey: `subagent-${i}-${Date.now()}`,
    label,
    status: i === 0 ? 'running' : randomFrom(['running', 'completed', 'completed'] as SubAgent['status'][]),
    task: randomFrom(TASK_NAMES),
    startedAt: generateTimestamp(2),
    model: randomFrom(['claude-opus-4-5', 'claude-sonnet-4-20250514', 'claude-haiku-3']),
    sourceDisplay: randomFrom(['#bri', '#general', 'DM']),
  }));
}

export function generateMockState(): DashboardState {
  const activities = generateMockActivities(35);
  const cronJobs = generateMockCronJobs();
  const subAgents = generateMockSubAgents();
  const errors = activities.filter(a => a.status === 'error').length;

  return {
    bri: {
      status: 'active',
      currentTask: randomFrom(TASK_NAMES),
      model: 'claude-opus-4-5',
      sessionKey: 'main',
      uptime: randomBetween(3600, 259200),
      lastActivity: new Date().toISOString(),
    },
    cronJobs,
    subAgents,
    recentActivity: activities,
    stats: {
      totalTasks24h: randomBetween(45, 180),
      activeSubAgents: subAgents.filter(a => a.status === 'running').length,
      activeCronJobs: cronJobs.filter(j => j.status === 'running' || j.status === 'scheduled').length,
      avgResponseTime: randomBetween(800, 4500),
      avgCompletionTime: randomBetween(2000, 12000),
    },
    lastUpdated: new Date().toISOString(),
  };
}

// Generate sparkline-style data (trending)
export function generateTrendData(points: number = 8, trend: 'up' | 'down' | 'stable' = 'up'): number[] {
  const data: number[] = [];
  let value = randomBetween(5, 20);
  for (let i = 0; i < points; i++) {
    const delta = trend === 'up' ? randomBetween(-2, 5) :
                  trend === 'down' ? randomBetween(-5, 2) :
                  randomBetween(-3, 3);
    value = Math.max(0, value + delta);
    data.push(value);
  }
  return data;
}
