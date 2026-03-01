'use client';

import { useEffect, useState, useCallback, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load recharts to avoid SSR issues with React 19
const LazyAreaChart = dynamic(() => import('recharts').then(m => {
  const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = m;
  return { default: ({ data }: { data: Array<{ name: string; ms: number }> }) => (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <Tooltip />
        <Area type="monotone" dataKey="ms" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )};
}), { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">Loading chart...</div> });

const LazyBarChart = dynamic(() => import('recharts').then(m => {
  const { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } = m;
  return { default: ({ data }: { data: Array<{ range: string; count: number }> }) => (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data}>
        <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
        <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )};
}), { ssr: false, loading: () => <div className="h-32 flex items-center justify-center text-[var(--text-muted)] text-sm">Loading chart...</div> });

// Error boundary for chart rendering
class ChartErrorBoundary extends Component<{ children: ReactNode; fallback?: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="text-[var(--text-muted)] text-sm py-4 text-center">{this.props.fallback || 'Chart unavailable'}</div>;
    return this.props.children;
  }
}

interface ObservabilityPanelProps {
  errorRate: number;
  totalActivities: number;
  avgResponseTime: number;
  avgCompletionTime?: number;
  cronJobs?: Array<{ name: string; status: string; lastRun: string; schedule?: string; result?: string }>;
  services?: Array<{ name: string; status: string; details?: string }>;
}

interface HealthData {
  dashboard: string;
  gateway: string;
  apiServer: string;
  memoryUsage?: { rss: number; heapUsed: number; heapTotal: number };
  timestamp: string;
}

interface MetricsRaw {
  avgResponseTime?: number;
  avgCompletionTime?: number;
  responseSamples?: number;
  completionSamples?: number;
  recentResponseTimes?: Array<{ ms: number; timestamp: number; source?: any }>;
  responseTimes?: Array<{ ms: number; timestamp: number; source?: any }>;
}

export function ObservabilityPanel({ errorRate, totalActivities, avgResponseTime, avgCompletionTime, cronJobs, services }: ObservabilityPanelProps) {
  const [metrics, setMetrics] = useState<MetricsRaw | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch('/api/gateway?endpoint=/api/metrics'),
        fetch('/api/gateway/health'),
      ]);
      if (metricsRes.ok) {
        const raw = await metricsRes.json();
        setMetrics(raw);
      }
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Normalize: API may return `recentResponseTimes` or `responseTimes`
  const responseTimes = metrics?.responseTimes || metrics?.recentResponseTimes || [];

  const responseTimeData = responseTimes
    .slice(0, 30)
    .reverse()
    .map((rt) => ({
      name: new Date(rt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ms: Math.round(rt.ms),
    }));

  const histogram = (() => {
    const buckets = [
      { range: '<2s', min: 0, max: 2000, count: 0 },
      { range: '2-5s', min: 2000, max: 5000, count: 0 },
      { range: '5-10s', min: 5000, max: 10000, count: 0 },
      { range: '10-30s', min: 10000, max: 30000, count: 0 },
      { range: '30s+', min: 30000, max: Infinity, count: 0 },
    ];
    responseTimes.forEach(rt => {
      const bucket = buckets.find(b => rt.ms >= b.min && rt.ms < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  })();

  // Failed crons
  const failedCrons = (cronJobs || []).filter(c => c.status === 'error');
  const healthyCrons = (cronJobs || []).filter(c => c.status === 'completed');

  const statusColor = (s: string) =>
    s === 'connected' || s === 'ok' ? 'text-green-400' :
    s === 'error' ? 'text-red-400' : 'text-yellow-400';

  const statusDot = (s: string) =>
    s === 'connected' || s === 'ok' ? 'bg-green-500' :
    s === 'error' ? 'bg-red-500' : 'bg-yellow-500';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-secondary)] px-1">Observability</h2>

      {/* System Health */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">System Health</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDot(health?.dashboard || 'ok')}`} />
            <span className="text-sm">Dashboard</span>
            <span className={`text-xs ml-auto ${statusColor(health?.dashboard || 'ok')}`}>
              {health?.dashboard || 'ok'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDot(health?.gateway || 'unknown')}`} />
            <span className="text-sm">Gateway</span>
            <span className={`text-xs ml-auto ${statusColor(health?.gateway || 'unknown')}`}>
              {health?.gateway || '...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusDot(health?.apiServer || 'unknown')}`} />
            <span className="text-sm">API Server</span>
            <span className={`text-xs ml-auto ${statusColor(health?.apiServer || 'unknown')}`}>
              {health?.apiServer || '...'}
            </span>
          </div>
          {health?.memoryUsage && (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-sm">Memory</span>
              <span className="text-xs ml-auto text-blue-400">
                {health.memoryUsage.heapUsed}MB / {health.memoryUsage.heapTotal}MB
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Failed Crons Alert */}
      {failedCrons.length > 0 && (
        <div className="bg-red-500/10 rounded-2xl p-4 border border-red-500/30">
          <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ Failed Cron Jobs ({failedCrons.length})</h3>
          <div className="space-y-2">
            {failedCrons.map((cron, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-primary)]">{cron.name}</span>
                <span className="text-xs text-red-400">{cron.lastRun !== '—' ? new Date(cron.lastRun).toLocaleDateString() : 'never ran'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Avg Response Time</p>
          <p className="text-2xl font-bold text-green-400">
            {avgResponseTime > 0 ? `${(avgResponseTime / 1000).toFixed(1)}s` : '-'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics?.responseSamples || 0} samples
          </p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Avg Completion</p>
          <p className="text-2xl font-bold text-yellow-400">
            {avgCompletionTime && avgCompletionTime > 0 ? `${(avgCompletionTime / 1000).toFixed(1)}s` : '-'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {metrics?.completionSamples || 0} samples
          </p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Error Rate</p>
          <p className={`text-2xl font-bold ${errorRate > 10 ? 'text-red-400' : errorRate > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
            {errorRate.toFixed(1)}%
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            of {totalActivities} activities
          </p>
        </div>
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <p className="text-xs text-[var(--text-muted)] mb-1">Cron Health</p>
          <p className={`text-2xl font-bold ${failedCrons.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {healthyCrons.length}/{(cronJobs || []).length}
          </p>
          <p className="text-xs text-[var(--text-muted)]">healthy crons</p>
        </div>
      </div>

      {/* Response Time Chart */}
      {responseTimeData.length > 2 && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Response Latency</h3>
          <ChartErrorBoundary fallback="Response latency chart unavailable">
            <LazyAreaChart data={responseTimeData} />
          </ChartErrorBoundary>
        </div>
      )}

      {/* Response Time Histogram */}
      {responseTimes.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Response Time Distribution</h3>
          <ChartErrorBoundary fallback="Distribution chart unavailable">
            <LazyBarChart data={histogram} />
          </ChartErrorBoundary>
        </div>
      )}

      {loading && !metrics && (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm">
          Loading metrics...
        </div>
      )}
    </div>
  );
}
