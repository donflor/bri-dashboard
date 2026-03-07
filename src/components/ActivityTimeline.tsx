'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/Badge';

interface ActivityEntry {
  id: string;
  agent_id?: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  source_type?: 'user_request' | 'automation_response' | 'cron' | null;
  source_channel?: string | null;
  source_user?: string | null;
  request_id?: string | null;
  response_time_ms?: number | null;
  severity?: string | null;
}

const ACTION_ICONS: Record<string, string> = {
  task_created: '📝',
  task_moved: '➡️',
  task_completed: '✅',
  approval_requested: '⏳',
  approval_approved: '✅',
  approval_rejected: '❌',
  agent_started: '🚀',
  agent_completed: '🏁',
  agent_failed: '💥',
  deployment: '🚀',
  cron_run: '⏰',
  message_sent: '💬',
  error: '🔴',
  system: '⚙️',
};

const AGENT_COLORS: Record<string, string> = {
  product_engineer: 'info', ux_architect: 'purple', qa_lead: 'purple',
  closer: 'warning', daba: 'success', seesee: 'warning', it_ops: 'default',
  router_agent: 'info', ceo_bri: 'danger', system: 'default',
};

const SOURCE_TYPE_CONFIG: Record<string, { icon: string; color: string; badgeVariant: 'info' | 'success' | 'purple' | 'default' }> = {
  user_request: { icon: '👤', color: 'text-blue-400', badgeVariant: 'info' },
  automation_response: { icon: '🤖', color: 'text-green-400', badgeVariant: 'success' },
  cron: { icon: '🕐', color: 'text-purple-400', badgeVariant: 'purple' },
};

const API_BASE = '/api/v2';

export function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterSourceType, setFilterSourceType] = useState('all');
  const [limit, setLimit] = useState(50);

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterAgent !== 'all') params.set('agent', filterAgent);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterSourceType !== 'all') params.set('source_type', filterSourceType);
      const res = await fetch(`${API_BASE}/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch activities:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, filterAgent, filterType, filterSourceType]);

  useEffect(() => {
    fetchActivities();
    const es = new EventSource('/api/stream');
    es.addEventListener('activity_log', () => fetchActivities());
    return () => es.close();
  }, [fetchActivities]);

  // Group activities by request_id for threading
  const groupedActivities = useMemo(() => {
    const requestMap = new Map<string, ActivityEntry[]>();
    const topLevel: ActivityEntry[] = [];

    for (const entry of activities) {
      if (entry.source_type === 'automation_response' && entry.request_id) {
        const existing = requestMap.get(entry.request_id) || [];
        existing.push(entry);
        requestMap.set(entry.request_id, existing);
      } else {
        topLevel.push(entry);
      }
    }

    return { topLevel, requestMap };
  }, [activities]);

  const uniqueAgents = [...new Set(activities.map(a => a.agent_id).filter(Boolean))].sort();
  const uniqueTypes = [...new Set(activities.map(a => a.action_type))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  function renderEntry(entry: ActivityEntry, idx: number, isChild: boolean = false, totalCount: number = 0) {
    const sourceConfig = entry.source_type ? SOURCE_TYPE_CONFIG[entry.source_type] : null;
    const icon = sourceConfig?.icon || ACTION_ICONS[entry.action_type] || '📋';
    const children = entry.request_id && !isChild
      ? groupedActivities.requestMap.get(entry.id) || []
      : [];

    return (
      <div key={entry.id}>
        <div
          className={`flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-[var(--bg-card)] transition-colors group ${isChild ? 'ml-8 border-l-2 border-[var(--border-color)] pl-4' : ''}`}
        >
          {/* Timeline dot */}
          <div className="flex flex-col items-center pt-1">
            <span className="text-base">{icon}</span>
            {!isChild && idx < totalCount - 1 && (
              <div className="w-px flex-1 bg-[var(--border-color)] mt-1 min-h-[16px]" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              {entry.agent_id && (
                <Badge variant={(AGENT_COLORS[entry.agent_id] || 'default') as 'info' | 'purple' | 'warning' | 'success' | 'danger' | 'default'} size="sm">
                  {entry.agent_id}
                </Badge>
              )}
              <Badge variant="default" size="sm">
                {entry.action_type.replace(/_/g, ' ')}
              </Badge>
              {sourceConfig && (
                <Badge variant={sourceConfig.badgeVariant} size="sm">
                  {entry.source_type!.replace(/_/g, ' ')}
                </Badge>
              )}
              {entry.source_user && (
                <Badge variant="info" size="sm">
                  {entry.source_user}
                </Badge>
              )}
            </div>
            <div className="text-sm text-[var(--text-primary)]">{entry.description}</div>
            {entry.response_time_ms != null && (
              <span className="text-[10px] text-[var(--text-muted)]">
                responded in {(entry.response_time_ms / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {/* Timestamp */}
          <span className="text-[10px] text-[var(--text-muted)] shrink-0 pt-1">
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Render threaded responses */}
        {children.map((child, cIdx) => renderEntry(child, cIdx, true, children.length))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Activity Timeline</h2>
        <span className="text-xs text-[var(--text-muted)]">{activities.length} events</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
        >
          <option value="all">All Agents</option>
          {uniqueAgents.map(a => (
            <option key={a} value={a!}>{a}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
        >
          <option value="all">All Types</option>
          {uniqueTypes.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filterSourceType}
          onChange={(e) => setFilterSourceType(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
        >
          <option value="all">All Sources</option>
          <option value="user_request">👤 User Requests</option>
          <option value="automation_response">🤖 Automation</option>
          <option value="cron">🕐 Cron</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {groupedActivities.topLevel.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <div className="text-4xl mb-2">📜</div>
            <div className="text-sm">No activity recorded yet</div>
          </div>
        ) : (
          groupedActivities.topLevel.map((entry, idx) =>
            renderEntry(entry, idx, false, groupedActivities.topLevel.length)
          )
        )}
      </div>

      {/* Load more */}
      {activities.length >= limit && (
        <div className="text-center">
          <button
            onClick={() => setLimit(prev => prev + 50)}
            className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Load more...
          </button>
        </div>
      )}
    </div>
  );
}
