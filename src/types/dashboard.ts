// Dashboard data types

export interface SubAgent {
  sessionKey: string;
  label?: string;
  status: 'running' | 'completed' | 'failed' | 'idle';
  task?: string;
  startedAt: string;
  completedAt?: string;
  model?: string;
}

export interface ActivityItem {
  id: string;
  type: 'task' | 'message' | 'subagent' | 'system';
  description: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending' | 'info';
  duration?: number; // ms
  metadata?: Record<string, unknown>;
}

export interface BriStatus {
  status: 'active' | 'idle' | 'thinking' | 'offline';
  currentTask?: string;
  model: string;
  sessionKey: string;
  uptime: number; // seconds
  lastActivity: string;
}

export interface DashboardState {
  bri: BriStatus;
  subAgents: SubAgent[];
  recentActivity: ActivityItem[];
  stats: {
    totalTasks24h: number;
    activeSubAgents: number;
    avgResponseTime: number; // ms
  };
  lastUpdated: string;
}

export interface WebSocketMessage {
  type: 'status_update' | 'activity' | 'subagent_update' | 'full_sync';
  payload: Partial<DashboardState> | ActivityItem | SubAgent | BriStatus;
  timestamp: string;
}
