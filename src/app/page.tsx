'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow, format } from 'date-fns';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Sparkline } from '@/components/Sparkline';
import { ActivityChart } from '@/components/ActivityChart';
import { ToastContainer, type ToastItem } from '@/components/Toast';
import { BottomSheet } from '@/components/BottomSheet';
import { EmptyState } from '@/components/EmptyState';
import { TaskBoard } from '@/components/TaskBoard';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { AgentLogStream } from '@/components/AgentLogStream';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { Tabs } from '@/components/ui/Tabs';
// Mock data removed — all data from real APIs
import type { ActivityItem, SubAgent } from '@/types/dashboard';
import { ObservabilityPanel } from '@/components/ObservabilityPanel';
import { AgentManagementPanel } from '@/components/AgentManagementPanel';
import clsx from 'clsx';

// ── Helpers ──────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500', thinking: 'bg-yellow-500 animate-pulse', idle: 'bg-gray-400',
    offline: 'bg-red-500', running: 'bg-blue-500 animate-pulse', completed: 'bg-green-500',
    failed: 'bg-red-500', error: 'bg-red-500', pending: 'bg-yellow-500 animate-pulse',
    in_progress: 'bg-blue-500 animate-pulse', scheduled: 'bg-purple-500',
    success: 'bg-green-500', info: 'bg-blue-400',
  };
  const sizeClass = size === 'lg' ? 'w-4 h-4' : 'w-2.5 h-2.5';
  return <span className={`inline-block ${sizeClass} rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-400', success: 'text-green-400', running: 'text-blue-400',
    in_progress: 'text-blue-400', pending: 'text-yellow-400', error: 'text-red-400',
    failed: 'text-red-400', info: 'text-blue-300',
  };
  return colors[status] || 'text-[var(--text-muted)]';
}

function TrendArrow({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  if (direction === 'stable') return <span className="text-[var(--text-muted)] text-xs">→</span>;
  return direction === 'up'
    ? <span className="text-green-400 text-xs">↑</span>
    : <span className="text-red-400 text-xs">↓</span>;
}

function haptic(ms: number = 10) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
}

type TabType = 'overview' | 'tasks' | 'approvals' | 'activity' | 'logs';
type TimeRange = '1h' | '24h' | '7d' | '30d';
type SheetData = { type: 'activity'; data: ActivityItem } | { type: 'agent'; data: SubAgent } | null;

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
};
const TIME_RANGE_HOURS: Record<TimeRange, number> = {
  '1h': 1, '24h': 24, '7d': 168, '30d': 720,
};

// ── Main Component ───────────────────────────────────────

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { state, connected, refresh } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sheetItem, setSheetItem] = useState<SheetData>(null);
  const prevActivityCountRef = useRef(0);
  const pullStartRef = useRef<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  // Sparkline trend data — derived from real activity data (no mock)
  const trendData = useMemo(() => {
    const trends = (state as any).trends;
    const zeros = [0, 0, 0, 0, 0, 0, 0, 0];
    if (trends) {
      return {
        tasks: trends.tasks?.length ? trends.tasks : zeros,
        cron: trends.cron?.length ? trends.cron : zeros,
        agents: trends.agents?.length ? trends.agents : zeros,
        response: trends.responseTimes?.length ? trends.responseTimes : zeros,
        completion: trends.completion?.length ? trends.completion : zeros,
        errors: trends.errors?.length ? trends.errors : zeros,
      };
    }
    return { tasks: zeros, cron: zeros, agents: zeros, response: zeros, completion: zeros, errors: zeros };
  }, [state]);

  // ── Auth redirect ──
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!session) router.push('/login');
  }, [session, authStatus, router]);

  // ── Toast on new activity (#12) ──
  useEffect(() => {
    const count = state.recentActivity.length;
    if (prevActivityCountRef.current > 0 && count > prevActivityCountRef.current) {
      const newest = state.recentActivity[0];
      if (newest) {
        setToasts(prev => [...prev, {
          id: newest.id,
          message: `New: ${newest.description.slice(0, 60)}`,
          type: newest.status === 'error' ? 'error' : 'info',
        }]);
      }
    }
    prevActivityCountRef.current = count;
  }, [state.recentActivity]);

  // ── Keyboard shortcuts (#10) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const tabs: Record<string, TabType> = { '1': 'status', '2': 'manage', '3': 'observe', '4': 'activity' };
      if (tabs[e.key]) { setActiveTab(tabs[e.key]); haptic(); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); refresh(); haptic(); }
      if (e.key === 'Escape') setSheetItem(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [refresh]);

  // ── Pull-to-refresh (#13) ──
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => { pullStartRef.current = e.touches[0].clientY; };
    const handleTouchMove = (e: TouchEvent) => {
      if (pullStartRef.current === null || window.scrollY > 0) return;
      const diff = e.touches[0].clientY - pullStartRef.current;
      if (diff > 0) setPullProgress(Math.min(diff / 100, 1));
    };
    const handleTouchEnd = () => {
      if (pullProgress >= 1) { refresh(); haptic(20); }
      setPullProgress(0);
      pullStartRef.current = null;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullProgress, refresh]);

  // ── Filtered activities (#2, #8) ──
  const filteredActivities = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGE_MS[timeRange];
    return state.recentActivity.filter(a => {
      if (new Date(a.timestamp).getTime() < cutoff) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.description.toLowerCase().includes(q) ||
               a.type.toLowerCase().includes(q) ||
               (a.sourceDisplay || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [state.recentActivity, timeRange, typeFilter, searchQuery]);

  // Error count
  const errorCount = useMemo(() =>
    state.recentActivity.filter(a => a.status === 'error').length,
    [state.recentActivity]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const switchTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    haptic();
  }, []);

  if (authStatus === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-primary)] flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* Pull-to-refresh indicator (#13) */}
      {pullProgress > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2" style={{ opacity: pullProgress }}>
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center"
               style={{ transform: `rotate(${pullProgress * 360}deg)` }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Toast notifications (#12) */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Bottom sheet detail view (#15) */}
      <BottomSheet item={sheetItem} onClose={() => setSheetItem(null)} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-overlay)] backdrop-blur border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🦾</span>
            <div>
              <h1 className="text-lg font-bold">Bri Mission Control</h1>
              <div className="flex items-center gap-2 text-xs">
                <StatusBadge status={state.bri.status} />
                <span className="text-[var(--text-secondary)] capitalize">{state.bri.status}</span>
                {/* Auto-refresh / Live indicator (#9) */}
                {connected && (
                  <span className="flex items-center gap-1 text-green-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live-pulse" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAdmin && (
              <button onClick={() => router.push('/admin')}
                className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors border border-[var(--border-color)]" title="Admin">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
            )}
            <button onClick={() => { refresh(); haptic(); }}
              className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors border border-[var(--border-color)]" title="Refresh (R)">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={() => signOut()}
              className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-colors border border-[var(--border-color)]" title="Sign out">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">

        <div className="max-w-4xl mx-auto p-4 pb-0">
          <Tabs 
            tabs={[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'tasks', label: 'Tasks', icon: '📝' },
              { id: 'approvals', label: 'Approvals', icon: '✅' },
              { id: 'activity', label: 'Activity', icon: '📋' },
              { id: 'logs', label: 'Agent Logs', icon: '📡' },
            ]}
            activeTab={activeTab}
            onChange={(id) => switchTab(id as TabType)}
          />
        </div>

        <div className="max-w-4xl mx-auto p-4 space-y-4">

          {/* ═══════════ OVERVIEW TAB ═══════════ */}
          {activeTab === 'overview' && (
            <>
              {/* Time range selector (#2) */}
              <div className="flex gap-2">
                {(['1h', '24h', '7d', '30d'] as TimeRange[]).map(r => (
                  <button key={r} onClick={() => { setTimeRange(r); haptic(); }}
                    className={clsx('px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border',
                      timeRange === r
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
                    )}>
                    {r}
                  </button>
                ))}
              </div>

              {/* System Health (#6) */}
              <div className="bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-card-hover)] rounded-2xl p-4 border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-3 h-3 rounded-full', connected ? 'bg-green-500 animate-live-pulse' : 'bg-red-500')} />
                    <div>
                      <p className="text-sm font-semibold">{connected ? 'Connected' : 'Disconnected'}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Last sync: {formatDistanceToNow(new Date(state.lastUpdated), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">Gateway</p>
                    <p className="text-sm font-mono">{state.bri.model}</p>
                  </div>
                </div>
              </div>

              {/* Status Card */}
              <div className="bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-card-hover)] rounded-3xl p-6 border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center text-3xl',
                      state.bri.status === 'active' ? 'bg-green-500/20' :
                      state.bri.status === 'thinking' ? 'bg-yellow-500/20' : 'bg-gray-700')}>
                      🦾
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold capitalize">{state.bri.status}</h2>
                      <p className="text-[var(--text-secondary)]">{state.bri.model}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatDuration(state.bri.uptime)}</p>
                    <p className="text-[var(--text-secondary)] text-sm">Uptime</p>
                  </div>
                </div>
                {state.bri.currentTask && (
                  <div className="bg-[var(--bg-primary)]/50 rounded-2xl p-4">
                    <p className="text-[var(--text-secondary)] text-sm mb-1">Current Task</p>
                    <p>{state.bri.currentTask}</p>
                  </div>
                )}
              </div>

              {/* Stats Grid with sparklines & trend arrows (#4) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-2xl font-bold">{state.stats.totalTasks24h}</p>
                    <TrendArrow direction="up" />
                  </div>
                  <Sparkline data={trendData.tasks} color="#3b82f6" />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Tasks ({timeRange})</p>
                </div>
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-2xl font-bold text-purple-400">{state.stats.activeCronJobs || 0}</p>
                    <TrendArrow direction="stable" />
                  </div>
                  <Sparkline data={trendData.cron} color="#a855f7" />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Cron Active</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 text-center border border-[var(--border-color)]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-2xl font-bold text-blue-400">{state.stats.activeSubAgents}</p>
                    <TrendArrow direction="up" />
                  </div>
                  <Sparkline data={trendData.agents} color="#3b82f6" />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Sub-Agents</p>
                </div>
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 text-center border border-[var(--border-color)]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-2xl font-bold text-green-400">
                      {state.stats.avgResponseTime > 0 ? `${(state.stats.avgResponseTime / 1000).toFixed(1)}s` : '-'}
                    </p>
                    <TrendArrow direction="down" />
                  </div>
                  <Sparkline data={trendData.response} color="#22c55e" />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Avg Response</p>
                </div>
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 text-center border border-[var(--border-color)]">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <p className="text-2xl font-bold text-yellow-400">
                      {state.stats.avgCompletionTime && state.stats.avgCompletionTime > 0
                        ? `${(state.stats.avgCompletionTime / 1000).toFixed(1)}s` : '-'}
                    </p>
                    <TrendArrow direction="stable" />
                  </div>
                  <Sparkline data={trendData.completion} color="#eab308" />
                  <p className="text-[var(--text-muted)] text-xs mt-1">Avg Complete</p>
                </div>
              </div>

              {/* Error rate tracking (#7) */}
              <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center',
                      errorCount > 5 ? 'bg-red-500/20' : errorCount > 0 ? 'bg-yellow-500/20' : 'bg-green-500/20')}>
                      {errorCount > 5 ? '🔴' : errorCount > 0 ? '🟡' : '🟢'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Error Rate</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {errorCount} errors in {state.recentActivity.length} activities
                        ({state.recentActivity.length > 0
                          ? ((errorCount / state.recentActivity.length) * 100).toFixed(1)
                          : 0}%)
                      </p>
                    </div>
                  </div>
                  <Sparkline data={trendData.errors} width={80} height={24} color="#ef4444" />
                </div>
              </div>

              {/* Activity timeline chart (#5) */}
              <ActivityChart activities={state.recentActivity} hours={TIME_RANGE_HOURS[timeRange]} />

              {/* Quick Activity Preview */}
              <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  {filteredActivities.length === 0 ? (
                    <p className="text-[var(--text-muted)] text-sm text-center py-4">No activity in this time range</p>
                  ) : (
                    filteredActivities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 text-sm cursor-pointer hover:bg-[var(--bg-card-hover)] rounded-lg p-1 -mx-1"
                           onClick={() => { setSheetItem({ type: 'activity', data: activity }); haptic(); }}>
                        <StatusBadge status={activity.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`truncate flex-1 ${getStatusColor(activity.status)}`}>{activity.description}</p>
                            {activity.sourceDisplay && (
                              <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{activity.sourceDisplay}</span>
                            )}
                          </div>
                          <p className="text-[var(--text-muted)] text-xs">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                            {activity.duration && ` • ${(activity.duration / 1000).toFixed(1)}s`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ═══════════ AGENT MANAGEMENT TAB ═══════════ */}
          {activeTab === 'manage' && (
            <AgentManagementPanel
              subAgents={state.subAgents}
              cronJobs={state.cronJobs}
              recentActivity={state.recentActivity}
              onSelectAgent={(agent) => { setSheetItem({ type: 'agent', data: agent }); haptic(); }}
              onSelectActivity={(activity) => { setSheetItem({ type: 'activity', data: activity }); haptic(); }}
            />
          )}

          {/* ═══════════ OBSERVABILITY TAB ═══════════ */}
          {activeTab === 'observe' && (
            <ObservabilityPanel
              errorRate={state.recentActivity.length > 0
                ? (errorCount / state.recentActivity.length) * 100 : 0}
              totalActivities={state.recentActivity.length}
              avgResponseTime={state.stats.avgResponseTime}
              avgCompletionTime={state.stats.avgCompletionTime}
              cronJobs={state.cronJobs}
            />
          )}

          
          {/* ═══════════ NEW BMC V2 TABS ═══════════ */}
          {activeTab === 'tasks' && <TaskBoard />}
          {activeTab === 'approvals' && <ApprovalQueue />}
          {activeTab === 'logs' && <AgentLogStream />}
          
          {/* ═══════════ ACTIVITY TIMELINE (V2) ═══════════ */}
          {activeTab === 'activity' && <ActivityTimeline />}
</div>
      </main>

      {/* Bottom Navigation */}
      
    </div>
  );
}
