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


interface InfraData {
  system?: { cpuCount: number; loadAvg: { '1m': string }; memory: { usedGB: string; totalGB: string; usedPercent: number }; diskUsage: string };
  redis?: { status: string; usedMemory?: string; maxMemory?: string; evictionPolicy?: string };
  bullmq?: { cluster: { status: string; workers: number; memoryMB?: number }; queues: Record<string, { active?: number; waiting?: number; completed?: number; failed?: number }> };
  docker?: { name: string; status: string; uptime: string }[];
  crm?: { total: number; withEmail: number; withPhone: number; hot: number; emailRate: number };
  blog?: { publishedPosts: number };
  architecture?: Record<string, any>;
}

export function ObservabilityPanel({ errorRate, totalActivities, avgResponseTime, avgCompletionTime }: ObservabilityPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [infra, setInfra] = useState<InfraData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const [metricsRes, healthRes, infraRes] = await Promise.all([
        fetch('/api/gateway?endpoint=/api/metrics'),
        fetch('/api/gateway/health'),
        fetch('/api/infra').catch(() => ({ ok: false } as Response)),
      ]);
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (infraRes.ok) setInfra(await infraRes.json());
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

      
      {/* Infrastructure Status */}
      {infra && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">🏗️ Infrastructure</h3>
          <div className="space-y-2 text-sm">
            {infra.system && (
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-[var(--text-muted)]">CPU</span><br/><span className="font-mono">{infra.system.cpuCount} cores ({infra.system.loadAvg['1m']} load)</span></div>
                <div><span className="text-[var(--text-muted)]">RAM</span><br/><span className="font-mono">{infra.system.memory.usedGB}/{infra.system.memory.totalGB}GB ({infra.system.memory.usedPercent}%)</span></div>
                <div><span className="text-[var(--text-muted)]">Disk</span><br/><span className="font-mono">{infra.system.diskUsage}</span></div>
              </div>
            )}
            {infra.redis && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                <span className={`w-2 h-2 rounded-full ${infra.redis.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>Redis</span>
                <span className="text-[var(--text-muted)] ml-auto font-mono text-xs">{infra.redis.usedMemory}/{infra.redis.maxMemory} | {infra.redis.evictionPolicy}</span>
              </div>
            )}
            {infra.bullmq?.cluster && (
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${infra.bullmq.cluster.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span>BullMQ Cluster</span>
                <span className="text-[var(--text-muted)] ml-auto font-mono text-xs">{infra.bullmq.cluster.workers} workers | {infra.bullmq.cluster.memoryMB || '?'}MB</span>
              </div>
            )}
            {infra.bullmq?.queues && (
              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[var(--border-color)]">
                {Object.entries(infra.bullmq.queues).map(([name, q]: [string, any]) => (
                  <div key={name} className="text-xs">
                    <span className="text-[var(--text-muted)]">{name}</span>
                    <span className="ml-1 font-mono">
                      {q.active > 0 && <span className="text-blue-400">{q.active}⚡</span>}
                      {q.waiting > 0 && <span className="text-yellow-400 ml-1">{q.waiting}⏳</span>}
                      {q.completed > 0 && <span className="text-green-400 ml-1">{q.completed}✓</span>}
                      {q.failed > 0 && <span className="text-red-400 ml-1">{q.failed}✗</span>}
                      {!q.active && !q.waiting && !q.completed && !q.failed && <span className="text-[var(--text-muted)]">idle</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {infra.docker && infra.docker.length > 0 && (
              <div className="pt-2 border-t border-[var(--border-color)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Docker ({infra.docker.length})</p>
                <div className="grid grid-cols-2 gap-1">
                  {infra.docker.map((c: any) => (
                    <div key={c.name} className="flex items-center gap-1 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="font-mono truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CRM & Pipeline */}
      {infra?.crm && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">📊 Pipeline</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Total Leads</p>
              <p className="text-xl font-bold text-blue-400">{infra.crm.total.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">With Email</p>
              <p className="text-xl font-bold text-green-400">{infra.crm.withEmail.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">({infra.crm.emailRate}%)</span></p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">With Phone</p>
              <p className="text-xl font-bold text-cyan-400">{infra.crm.withPhone.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Hot Leads</p>
              <p className="text-xl font-bold text-red-400">{infra.crm.hot}</p>
            </div>
          </div>
          {infra.blog && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex justify-between">
              <span className="text-xs text-[var(--text-muted)]">Blog Posts</span>
              <span className="text-sm font-bold text-purple-400">{infra.blog.publishedPosts}</span>
            </div>
          )}
        </div>
      )}

      {/* Architecture */}
      {infra?.architecture && (
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">⚡ Architecture</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Router Agent</span><span className="font-mono">{infra.architecture.routerAgent?.model} ({infra.architecture.routerAgent?.targetLatency})</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">LLM Primary</span><span className="font-mono">{infra.architecture.llmCascade?.primary}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">LLM Fallback</span><span className="font-mono">{infra.architecture.llmCascade?.fallback}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">DB Pooling</span><span className="font-mono">{infra.architecture.dbPooling?.mode} :{infra.architecture.dbPooling?.port}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Cache</span><span className="font-mono">{infra.architecture.cachePolicy?.eviction} / {infra.architecture.cachePolicy?.maxMemory}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-muted)]">Data Pruning</span><span className="font-mono">{infra.architecture.dataPruning?.schedule}</span></div>
          </div>
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
