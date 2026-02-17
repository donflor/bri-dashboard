'use client';

import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import type { SubAgent, CronJob, ActivityItem } from '@/types/dashboard';
import { EmptyState } from './EmptyState';
import clsx from 'clsx';

interface AgentManagementPanelProps {
  subAgents: SubAgent[];
  cronJobs: CronJob[];
  recentActivity: ActivityItem[];
  onSelectAgent?: (agent: SubAgent) => void;
  onSelectActivity?: (activity: ActivityItem) => void;
}

type SubTab = 'agents' | 'cron' | 'feed';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-blue-500 animate-pulse', completed: 'bg-green-500',
    failed: 'bg-red-500', error: 'bg-red-500', idle: 'bg-gray-400',
    scheduled: 'bg-purple-500',
  };
  return <span className={`w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function AgentManagementPanel({
  subAgents, cronJobs, recentActivity, onSelectAgent, onSelectActivity,
}: AgentManagementPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('agents');

  const activeAgents = subAgents.filter(a => a.status === 'running');
  const completedAgents = subAgents.filter(a => a.status !== 'running');
  const liveFeed = recentActivity.slice(0, 20);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-secondary)] px-1">Agent Management</h2>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-color)]">
        {([
          { id: 'agents' as SubTab, label: `Agents (${subAgents.length})`, icon: '🤖' },
          { id: 'cron' as SubTab, label: `Cron (${cronJobs.length})`, icon: '⏰' },
          { id: 'feed' as SubTab, label: 'Live Feed', icon: '📡' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={clsx('flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              subTab === tab.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            )}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Agents sub-tab */}
      {subTab === 'agents' && (
        <div className="space-y-3">
          {subAgents.length === 0 ? (
            <EmptyState icon="🤖" title="No sub-agents" subtitle="Sub-agents appear here when spawned for complex tasks" />
          ) : (
            <>
              {activeAgents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider px-1">Active ({activeAgents.length})</p>
                  {activeAgents.map(agent => (
                    <div key={agent.sessionKey}
                      className="bg-[var(--bg-card)] rounded-2xl p-4 border border-blue-500/30 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                      onClick={() => onSelectAgent?.(agent)}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                          <StatusBadge status={agent.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate text-sm">{agent.label || agent.sessionKey}</p>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 animate-pulse">
                              running
                            </span>
                          </div>
                          {agent.task && <p className="text-[var(--text-secondary)] text-xs mt-1 line-clamp-2">{agent.task}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                            <span>⏱ {formatDuration(agent.startedAt)}</span>
                            {agent.model && <span>🧠 {agent.model}</span>}
                            {agent.sourceDisplay && <span>📍 {agent.sourceDisplay}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {completedAgents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider px-1">Recent ({completedAgents.length})</p>
                  {completedAgents.slice(0, 5).map(agent => (
                    <div key={agent.sessionKey}
                      className="bg-[var(--bg-card)] rounded-xl p-3 border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors opacity-80"
                      onClick={() => onSelectAgent?.(agent)}>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={agent.status} />
                        <p className="text-sm truncate flex-1">{agent.label || agent.sessionKey}</p>
                        <span className={clsx('text-xs',
                          agent.status === 'completed' ? 'text-green-400' : 'text-red-400')}>
                          {agent.status}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDuration(agent.startedAt, agent.completedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Cron sub-tab */}
      {subTab === 'cron' && (
        <div className="space-y-2">
          {cronJobs.length === 0 ? (
            <EmptyState icon="⏰" title="No cron jobs" subtitle="Scheduled tasks will appear here" />
          ) : (
            cronJobs.map(job => (
              <div key={job.id}
                className={clsx('bg-[var(--bg-card)] rounded-xl p-4 border transition-colors',
                  job.status === 'running' ? 'border-blue-500/30' :
                  job.status === 'error' ? 'border-red-500/30' : 'border-[var(--border-color)]')}>
                <div className="flex items-start gap-3">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center',
                    job.status === 'running' ? 'bg-blue-500/20' :
                    job.status === 'error' ? 'bg-red-500/20' : 'bg-green-500/20')}>
                    <span className="text-lg">{job.status === 'running' ? '🔄' : job.status === 'error' ? '❌' : '✅'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{job.name}</p>
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs',
                        job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                        job.status === 'error' ? 'bg-red-500/20 text-red-400' :
                        'bg-green-500/20 text-green-400')}>
                        {job.status}
                      </span>
                    </div>
                    {job.result && (
                      <p className="text-[var(--text-secondary)] text-xs line-clamp-1">{job.result}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      <span>Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}</span>
                      {job.nextRun && (
                        <span>Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}</span>
                      )}
                      {job.schedule && <span className="font-mono">{job.schedule}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Live Feed sub-tab */}
      {subTab === 'feed' && (
        <div className="space-y-1">
          {liveFeed.length === 0 ? (
            <EmptyState icon="📡" title="No recent activity" subtitle="Agent actions will stream here in real-time" />
          ) : (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] divide-y divide-[var(--border-color)]">
              {liveFeed.map(activity => (
                <div key={activity.id}
                  className="px-4 py-2.5 hover:bg-[var(--bg-card-hover)] cursor-pointer transition-colors"
                  onClick={() => onSelectActivity?.(activity)}>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activity.status} />
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded',
                      activity.type === 'cron' ? 'bg-purple-500/20 text-purple-400' :
                      activity.type === 'message' ? 'bg-blue-500/20 text-blue-400' :
                      activity.type === 'subagent' ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-gray-700 text-[var(--text-muted)]')}>
                      {activity.type}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">
                      {format(new Date(activity.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] mt-1 truncate">{activity.description}</p>
                  {activity.duration && (
                    <span className="text-xs text-green-500">{(activity.duration / 1000).toFixed(1)}s</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
