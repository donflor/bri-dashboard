'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/Badge';

interface ActivityEntry {
  id: string;
  agent_id?: string;
  action_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
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

const API_BASE = '/api/v2';

export function ActivityTimeline() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [limit, setLimit] = useState(50);

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filterAgent !== 'all') params.set('agent', filterAgent);
      if (filterType !== 'all') params.set('type', filterType);
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
  }, [limit, filterAgent, filterType]);

  useEffect(() => {
    fetchActivities();
    const es = new EventSource('/api/stream');
    es.addEventListener('activity_log', () => fetchActivities());
    return () => es.close();
  }, [fetchActivities]);

  const uniqueAgents = [...new Set(activities.map(a => a.agent_id).filter(Boolean))].sort();
  const uniqueTypes = [...new Set(activities.map(a => a.action_type))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
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
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {activities.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <div className="text-4xl mb-2">📜</div>
            <div className="text-sm">No activity recorded yet</div>
          </div>
        ) : (
          activities.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 py-2.5 px-3 rounded-xl hover:bg-[var(--bg-card)] transition-colors group"
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-1">
                <span className="text-base">{ACTION_ICONS[entry.action_type] || '📋'}</span>
                {idx < activities.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--border-color)] mt-1 min-h-[16px]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {entry.agent_id && (
                    <Badge variant={(AGENT_COLORS[entry.agent_id] || 'default') as 'info' | 'purple' | 'warning' | 'success' | 'danger' | 'default'} size="sm">
                      {entry.agent_id}
                    </Badge>
                  )}
                  <Badge variant="default" size="sm">
                    {entry.action_type.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="text-sm text-[var(--text-primary)]">{entry.description}</div>
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-[var(--text-muted)] shrink-0 pt-1">
                {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </div>
          ))
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
