'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from './ui/Badge';

interface InfraMetrics {
  cpu: { usagePercent: number; loadAvg: [number, number, number]; cores: number };
  memory: { totalMB: number; usedMB: number; freeMB: number; usagePercent: number; swapTotalMB: number; swapUsedMB: number };
  disk: { totalGB: number; usedGB: number; availGB: number; usagePercent: number };
  uptime: number;
  topProcesses: { pid: number; user: string; cpu: number; mem: number; command: string }[];
  network: { rxBytesPerSec: number; txBytesPerSec: number };
  docker: { name: string; image: string; status: string; cpu: string; mem: string }[];
  timestamp: string;
}

function GaugeRing({ percent, size = 120, label, color }: { percent: number; size?: number; label: string; color: string }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const alertColor = percent > 90 ? '#ef4444' : percent > 75 ? '#f59e0b' : color;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-color)" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={alertColor} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold text-[var(--text-primary)]">{percent}%</span>
      </div>
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

function ProgressBar({ percent, color, label, detail }: { percent: number; color: string; label: string; detail: string }) {
  const alertColor = percent > 90 ? '#ef4444' : percent > 75 ? '#f59e0b' : color;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-muted)]">{detail}</span>
      </div>
      <div className="h-2.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: alertColor }}
        />
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function shortenName(name: string): string {
  return name.replace('openclaw-mission-control-', 'omc-').replace(/-1$/, '');
}

export function InfraMonitor() {
  const [metrics, setMetrics] = useState<InfraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  const fetchMetrics = useCallback(async () => {
    try {
      // Fetch from the droplet API server (proxied via /bmc/) since infra metrics need server-side exec
      const apiBase = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? `${window.location.protocol}//${window.location.hostname}:8080/bmc`
        : '';
      const res = await fetch(`${apiBase}/api/v2/infra-metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setCpuHistory(prev => [...prev.slice(-29), data.cpu.usagePercent]);
        setMemHistory(prev => [...prev.slice(-29), data.memory.usagePercent]);
        setError(null);
      } else {
        setError('Failed to fetch metrics');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // every 10s
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-center py-12 text-red-400">
        <div className="text-3xl mb-2">⚠️</div>
        <div className="text-sm">{error || 'No metrics available'}</div>
      </div>
    );
  }

  const MiniSparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (data.length < 2) return null;
    const max = Math.max(...data, 100);
    const h = 40;
    const w = 200;
    const step = w / (data.length - 1);
    const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');
    return (
      <svg width={w} height={h} className="opacity-60">
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Infrastructure</h2>
          <Badge variant="info" size="sm">DigitalOcean</Badge>
          <span className="text-xs text-[var(--text-muted)]">159.65.107.113</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-[var(--text-muted)]">Live · 10s refresh</span>
          <span className="text-xs text-[var(--text-muted)]">Up {formatUptime(metrics.uptime)}</span>
        </div>
      </div>

      {/* Gauge Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* CPU */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">🔥 CPU</span>
            <Badge variant={metrics.cpu.usagePercent > 80 ? 'danger' : metrics.cpu.usagePercent > 50 ? 'warning' : 'success'} size="sm">
              {metrics.cpu.usagePercent}%
            </Badge>
          </div>
          <div className="relative flex justify-center mb-3">
            <GaugeRing percent={metrics.cpu.usagePercent} label="" color="#3b82f6" />
          </div>
          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <div className="flex justify-between"><span>Load Avg</span><span>{metrics.cpu.loadAvg.map(l => l.toFixed(2)).join(' / ')}</span></div>
            <div className="flex justify-between"><span>Cores</span><span>{metrics.cpu.cores}</span></div>
          </div>
          <div className="mt-2"><MiniSparkline data={cpuHistory} color="#3b82f6" /></div>
        </div>

        {/* Memory */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">🧠 Memory</span>
            <Badge variant={metrics.memory.usagePercent > 85 ? 'danger' : metrics.memory.usagePercent > 65 ? 'warning' : 'success'} size="sm">
              {metrics.memory.usagePercent}%
            </Badge>
          </div>
          <div className="relative flex justify-center mb-3">
            <GaugeRing percent={metrics.memory.usagePercent} label="" color="#8b5cf6" />
          </div>
          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <div className="flex justify-between"><span>Used</span><span>{(metrics.memory.usedMB / 1024).toFixed(1)}G / {(metrics.memory.totalMB / 1024).toFixed(1)}G</span></div>
            <div className="flex justify-between"><span>Swap</span><span>{(metrics.memory.swapUsedMB / 1024).toFixed(1)}G / {(metrics.memory.swapTotalMB / 1024).toFixed(1)}G</span></div>
          </div>
          <div className="mt-2"><MiniSparkline data={memHistory} color="#8b5cf6" /></div>
        </div>

        {/* Disk */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">💾 Disk</span>
            <Badge variant={metrics.disk.usagePercent > 90 ? 'danger' : metrics.disk.usagePercent > 75 ? 'warning' : 'success'} size="sm">
              {metrics.disk.usagePercent}%
            </Badge>
          </div>
          <div className="relative flex justify-center mb-3">
            <GaugeRing percent={metrics.disk.usagePercent} label="" color="#10b981" />
          </div>
          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <div className="flex justify-between"><span>Used</span><span>{metrics.disk.usedGB}G / {metrics.disk.totalGB}G</span></div>
            <div className="flex justify-between"><span>Available</span><span>{metrics.disk.availGB}G</span></div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">🌐 Network</span>
            <Badge variant="info" size="sm">eth0</Badge>
          </div>
          <div className="flex flex-col items-center justify-center h-[120px] gap-4">
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">⬇ Inbound</div>
              <div className="text-xl font-bold text-green-400">{formatBytes(metrics.network.rxBytesPerSec)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">⬆ Outbound</div>
              <div className="text-xl font-bold text-blue-400">{formatBytes(metrics.network.txBytesPerSec)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Docker Containers */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">🐳 Docker Containers</h3>
        <div className="space-y-2">
          {metrics.docker.map((c) => {
            const cpuNum = parseFloat(c.cpu) || 0;
            return (
              <div key={c.name} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors">
                <span className={`w-2 h-2 rounded-full ${c.status.includes('healthy') || c.status.startsWith('Up') ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-xs font-medium text-[var(--text-primary)] w-40 truncate" title={c.name}>{shortenName(c.name)}</span>
                <span className="text-[10px] text-[var(--text-muted)] w-28 truncate">{c.image}</span>
                <div className="flex-1">
                  <ProgressBar percent={cpuNum} color="#3b82f6" label="" detail={c.cpu} />
                </div>
                <span className="text-[10px] text-[var(--text-muted)] w-28 text-right">{c.mem}</span>
              </div>
            );
          })}
          {metrics.docker.length === 0 && (
            <div className="text-xs text-[var(--text-muted)] text-center py-4">No containers running</div>
          )}
        </div>
      </div>

      {/* Top Processes */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">⚡ Top Processes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="text-left py-2 px-2 w-16">PID</th>
                <th className="text-left py-2 px-2 w-20">User</th>
                <th className="text-right py-2 px-2 w-16">CPU%</th>
                <th className="text-right py-2 px-2 w-16">MEM%</th>
                <th className="text-left py-2 px-2">Command</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topProcesses.map((p) => (
                <tr key={p.pid} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-card-hover)] transition-colors">
                  <td className="py-1.5 px-2 text-[var(--text-muted)]">{p.pid}</td>
                  <td className="py-1.5 px-2 text-[var(--text-secondary)]">{p.user}</td>
                  <td className="py-1.5 px-2 text-right">
                    <span className={p.cpu > 50 ? 'text-red-400 font-bold' : p.cpu > 20 ? 'text-yellow-400' : 'text-[var(--text-secondary)]'}>
                      {p.cpu.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right text-[var(--text-secondary)]">{p.mem.toFixed(1)}</td>
                  <td className="py-1.5 px-2 text-[var(--text-muted)] font-mono truncate max-w-[300px]">{p.command}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
