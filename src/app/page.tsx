'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { Sparkline } from '@/components/Sparkline';
import { ToastContainer, type ToastItem } from '@/components/Toast';
import { BottomSheet } from '@/components/BottomSheet';
import { TaskBoard } from '@/components/TaskBoard';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { AgentLogStream } from '@/components/AgentLogStream';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { InfraMonitor } from '@/components/InfraMonitor';
import { AgentManagementPanel } from '@/components/AgentManagementPanel';
import { ObservabilityPanel } from '@/components/ObservabilityPanel';
import GlasshouseLayout from '@/components/btp/GlasshouseLayout';
import { EnvironmentProvider, useEnvironment } from '@/contexts/EnvironmentContext';
import { Sidebar, type SidebarTab } from '@/components/Sidebar';
import { InfraHeader } from '@/components/InfraHeader';
import { ErrorRateChart } from '@/components/charts/ErrorRateChart';
import { ActivityBarChart } from '@/components/charts/ActivityBarChart';
import { ProfitEngineWidget } from '@/components/dashboard/ProfitEngineWidget';
import type { ActivityItem, SubAgent } from '@/types/dashboard';
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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-400', success: 'text-green-400', running: 'text-blue-400',
    in_progress: 'text-blue-400', pending: 'text-yellow-400', error: 'text-red-400',
    failed: 'text-red-400', info: 'text-blue-300',
  };
  return colors[status] || 'text-[var(--text-muted)]';
}

function haptic(ms: number = 10) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
}

type TimeRange = '1h' | '24h' | '7d' | '30d';
type SheetData = { type: 'activity'; data: ActivityItem } | { type: 'agent'; data: SubAgent } | null;

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
};
const TIME_RANGE_HOURS: Record<TimeRange, number> = {
  '1h': 1, '24h': 24, '7d': 168, '30d': 720,
};

// ── Inner Dashboard (needs EnvironmentProvider context) ──

function DashboardInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { state, connected, refresh } = useWebSocket();
  const { isSandbox } = useEnvironment();
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sheetItem, setSheetItem] = useState<SheetData>(null);
  const prevActivityCountRef = useRef(0);
  const pullStartRef = useRef<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  // Sparkline trend data
  const trendData = useMemo(() => {
    const trends = (state as unknown as Record<string, unknown>).trends as Record<string, number[]> | undefined;
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

  // Auth redirect
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!session) router.push('/login');
  }, [session, authStatus, router]);

  // Toast on new activity
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

  // Keyboard shortcuts — map 1-9 to sidebar tabs
  useEffect(() => {
    const tabMap: Record<string, SidebarTab> = {
      '1': 'overview', '2': 'profit', '3': 'approvals', '4': 'manage',
      '5': 'tasks', '6': 'activity', '7': 'infra', '8': 'logs', '9': 'sandbox',
    };
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (tabMap[e.key]) { setActiveTab(tabMap[e.key]); haptic(); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); refresh(); haptic(); }
      if (e.key === 'Escape') setSheetItem(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [refresh]);

  // Pull-to-refresh
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

  // Filtered activities for overview
  const filteredActivities = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGE_MS[timeRange];
    return state.recentActivity.filter(a => {
      if (new Date(a.timestamp).getTime() < cutoff) return false;
      return true;
    });
  }, [state.recentActivity, timeRange]);

  const errorCount = useMemo(() =>
    state.recentActivity.filter(a => a.status === 'error').length,
    [state.recentActivity]
  );

  // Pending approvals count (from recent activity with type pending)
  const pendingApprovalsCount = useMemo(() =>
    state.recentActivity.filter(a => a.status === 'pending').length,
    [state.recentActivity]
  );

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const switchTab = useCallback((tab: SidebarTab) => {
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
    <div className={clsx(
      'min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex',
      isSandbox && 'border-t-[3px] border-t-amber-500'
    )}>
      {/* Pull-to-refresh indicator */}
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

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <BottomSheet item={sheetItem} onClose={() => setSheetItem(null)} />

      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={switchTab}
        userEmail={session.user?.email}
        userName={session.user?.name}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Compact Infrastructure Header */}
        <InfraHeader
          state={state}
          connected={connected}
          onRefresh={() => { refresh(); haptic(); }}
          isAdmin={isAdmin}
          onAdminClick={() => router.push('/admin')}
        />

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">

            {/* ═══════════ OVERVIEW (Executive Dashboard) ═══════════ */}
            {activeTab === 'overview' && (
              <>
                {/* Time range selector */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Executive Overview</h2>
                  <div className="flex gap-1.5">
                    {(['1h', '24h', '7d', '30d'] as TimeRange[]).map(r => (
                      <button key={r} onClick={() => { setTimeRange(r); haptic(); }}
                        className={clsx('px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                          timeRange === r
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                        )}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 1: 3-column executive KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Active Agent Count */}
                  <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <div className={clsx(
                          'w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold',
                          state.stats.activeSubAgents > 0 ? 'bg-blue-500/15 text-blue-400' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                        )}>
                          {state.stats.activeSubAgents}
                        </div>
                        {state.stats.activeSubAgents > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full animate-live-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Active Agents</p>
                        <p className="text-xs text-[var(--text-muted)]">Sub-agents running now</p>
                      </div>
                    </div>
                    <Sparkline data={trendData.agents} color="#3b82f6" />
                  </div>

                  {/* Profit Metrics Placeholder */}
                  <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-green-500/15">
                        💰
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Profit Metrics</p>
                        <p className="text-xs text-[var(--text-muted)]">MRR vs API Burn</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-green-400">$0</span>
                      <span className="text-xs text-[var(--text-muted)]">MRR</span>
                      <span className="text-[var(--text-muted)]">/</span>
                      <span className="text-lg font-bold text-red-400">$0</span>
                      <span className="text-xs text-[var(--text-muted)]">burn</span>
                    </div>
                  </div>

                  {/* Pending Approvals */}
                  <button
                    onClick={() => switchTab('approvals')}
                    className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border)] text-left hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={clsx(
                        'w-14 h-14 rounded-full flex items-center justify-center text-2xl',
                        pendingApprovalsCount > 0 ? 'bg-yellow-500/15' : 'bg-[var(--bg-hover)]'
                      )}>
                        {pendingApprovalsCount > 0 ? '⚠️' : '✅'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Pending Approvals</p>
                        <p className="text-xs text-[var(--text-muted)]">Requires attention</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={clsx('text-2xl font-bold',
                        pendingApprovalsCount > 0 ? 'text-yellow-400' : 'text-green-400'
                      )}>
                        {pendingApprovalsCount}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {pendingApprovalsCount > 0 ? 'need review →' : 'all clear'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Row 2: Error Rate + Activity Charts (Recharts) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ErrorRateChart activities={state.recentActivity} hours={TIME_RANGE_HOURS[timeRange]} />
                  <ActivityBarChart activities={state.recentActivity} hours={TIME_RANGE_HOURS[timeRange]} />
                </div>

                {/* Row 3: Recent Activity (limited to 5) */}
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Recent Activity</h3>
                    <button onClick={() => switchTab('activity')}
                      className="text-xs text-[var(--accent)] hover:underline">
                      View all →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {filteredActivities.length === 0 ? (
                      <p className="text-[var(--text-muted)] text-sm text-center py-4">No activity in this time range</p>
                    ) : (
                      filteredActivities.slice(0, 5).map((activity) => (
                        <div key={activity.id}
                          className="flex items-start gap-3 text-sm cursor-pointer hover:bg-[var(--bg-hover)] rounded-lg p-1.5 -mx-1"
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

                {/* Observability metrics merged from old Observe tab */}
                <ObservabilityPanel
                  errorRate={state.recentActivity.length > 0
                    ? (errorCount / state.recentActivity.length) * 100 : 0}
                  totalActivities={state.recentActivity.length}
                  avgResponseTime={state.stats.avgResponseTime}
                  avgCompletionTime={state.stats.avgCompletionTime}
                  cronJobs={state.cronJobs}
                />
              </>
            )}

            {/* ═══════════ PROFIT ENGINE ═══════════ */}
            {activeTab === 'profit' && <ProfitEngineWidget />}

            {/* ═══════════ APPROVALS ═══════════ */}
            {activeTab === 'approvals' && <ApprovalQueue />}

            {/* ═══════════ AGENT FLEET (was "manage") ═══════════ */}
            {activeTab === 'manage' && (
              <AgentManagementPanel
                subAgents={state.subAgents}
                cronJobs={state.cronJobs}
                recentActivity={state.recentActivity}
                onSelectAgent={(agent) => { setSheetItem({ type: 'agent', data: agent }); haptic(); }}
                onSelectActivity={(activity) => { setSheetItem({ type: 'activity', data: activity }); haptic(); }}
              />
            )}

            {/* ═══════════ TASKS ═══════════ */}
            {activeTab === 'tasks' && <TaskBoard />}

            {/* ═══════════ ACTIVITY ═══════════ */}
            {activeTab === 'activity' && <ActivityTimeline />}

            {/* ═══════════ INFRA ═══════════ */}
            {activeTab === 'infra' && <InfraMonitor />}

            {/* ═══════════ LOGS ═══════════ */}
            {activeTab === 'logs' && <AgentLogStream />}

            {/* ═══════════ BTP SANDBOX ═══════════ */}
            {activeTab === 'sandbox' && <GlasshouseLayout />}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Main Export with Provider wrapper ──

export default function Dashboard() {
  return (
    <EnvironmentProvider>
      <DashboardInner />
    </EnvironmentProvider>
  );
}
