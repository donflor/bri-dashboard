'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { MetricsData, SystemHealth } from '@/types/dashboard';

interface ObservabilityPanelProps {
  errorRate: number;
  totalActivities: number;
  avgResponseTime: number;
  avgCompletionTime?: number;
}

interface HealthData {
  dashboard: string;
  gateway: string;
  apiServer: string;
  memoryUsage?: { rss: number; heapUsed: number; heapTotal: number };
  timestamp: string;
}

// Custom tooltip styling
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-[var(--text-muted)]">{label}</p>
      <p className="text-[var(--text-primary)] font-semibold">{payload[0].value.toLocaleString()}ms</p>
    </div>
  );
}

export function ObservabilityPanel({ errorRate, totalActivities, avgResponseTime, avgCompletionTime }: ObservabilityPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, healthRes] = await Promise.all([
        fetch('/api/gateway?endpoint=/api/metrics'),
        fetch('/api/gateway/health'),
      ]);
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  // Format response time data for charts
  const responseTimeData = (metrics?.responseTimes || [])
    .slice(0, 30)
    .reverse()
    .map((rt, i) => ({
      name: new Date(rt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ms: Math.round(rt.ms),
      idx: i,
    }));

  // Bucket response times into histogram
  const histogram = (() => {
    const buckets = [
      { range: '<2s', min: 0, max: 2000, count: 0 },
      { range: '2-5s', min: 2000, max: 5000, count: 0 },
      { range: '5-10s', min: 5000, max: 10000, count: 0 },
      { range: '10-30s', min: 10000, max: 30000, count: 0 },
      { range: '30s+', min: 30000, max: Infinity, count: 0 },
    ];
    (metrics?.responseTimes || []).forEach(rt => {
      const bucket = buckets.find(b => rt.ms >= b.min && rt.ms < b.max);
      if (bucket) bucket.count++;
    });
    return buckets;
  })();

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
          <p className="text-xs text-[var(--text-muted)] mb-1">Total Activities</p>
          <p className="text-2xl font-bold text-blue-400">{totalActivities}</p>
          <p className="text-xs text-[var(--text-muted)]">last 24h</p>
        </div>
      </div>

      {/* Response Time Chart */}
      {responseTimeData.length > 2 && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Response Latency</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="ms"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Response Time Histogram */}
      {metrics && metrics.responseSamples > 0 && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Response Time Distribution</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={histogram}>
              <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
