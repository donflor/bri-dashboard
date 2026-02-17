// Dashboard data types

export interface Source {
  type: 'slack' | 'cron' | 'subagent' | 'unknown';
  channel?: string | null;
  channelType?: 'dm' | 'channel';
  user?: string | null;
}

export interface SubAgent {
  sessionKey: string;
  label?: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  task?: string;
  startedAt: string;
  completedAt?: string;
  model?: string;
  source?: Source;
  sourceDisplay?: string | null;
}

export interface CronJob {
  id: string;
  name: string;
  lastRun: string;
  nextRun?: string;
  schedule?: string;
  status: 'running' | 'completed' | 'error' | 'scheduled';
  result?: string;
  sessionKey?: string;
}

export interface ActivityItem {
  id: string;
  type: 'task' | 'message' | 'subagent' | 'system' | 'cron' | 'incoming';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending' | 'info' | 'completed' | 'in_progress' | 'running';
  duration?: number; // ms
  cronName?: string;
  metadata?: Record<string, unknown>;
  source?: Source;
  sourceDisplay?: string | null;
}

export interface BriStatus {
  status: 'active' | 'idle' | 'thinking' | 'offline';
  currentTask?: string;
  model: string;
  sessionKey: string;
  uptime: number; // seconds
  lastActivity: string;
}

export interface MetricsData {
  responseTimes: { ms: number; timestamp: number; source?: string }[];
  completionTimes: { ms: number; timestamp: number; source?: string }[];
  responseSamples: number;
  completionSamples: number;
  avgResponseTime: number;
  avgCompletionTime: number;
}

export interface SystemHealth {
  gateway: 'connected' | 'disconnected' | 'error';
  apiServer: 'connected' | 'disconnected' | 'error';
  uptime: number;
  memoryUsage?: { rss: number; heapUsed: number; heapTotal: number };
  lastCheck: string;
}

export interface DashboardState {
  bri: BriStatus;
  cronJobs: CronJob[];
  subAgents: SubAgent[];
  recentActivity: ActivityItem[];
  stats: {
    totalTasks24h: number;
    activeSubAgents: number;
    activeCronJobs: number;
    avgResponseTime: number; // ms - time to first response
    avgCompletionTime?: number; // ms - total task completion time
    tokenUsage?: number;
    estimatedCost?: number;
    errorRate?: number;
  };
  lastUpdated: string;
}

export interface WebSocketMessage {
  type: 'status_update' | 'activity' | 'subagent_update' | 'full_sync';
  payload: Partial<DashboardState> | ActivityItem | SubAgent | BriStatus;
  timestamp: string;
}
