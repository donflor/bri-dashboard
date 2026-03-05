'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

// ── Types ──────────────────────────────────────────────

interface ProfitEngineData {
  current: {
    mrr: number;
    totalBurn: number;
    netMargin: number;
    marginPercent: number;
    subscribers: number;
  };
  trend: Array<{
    date: string;
    revenue: number;
    costs: number;
  }>;
  breakdown: {
    twilio: number;
    elevenlabs: number;
    llm: number;
    infra: number;
  };
  lastUpdated: string;
}

// ── Helpers ────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM dd');
  } catch {
    return dateStr;
  }
}

// ── Skeleton ───────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-5">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 bg-[var(--bg-primary)] rounded animate-pulse" />
        <div className="h-4 w-28 bg-[var(--bg-primary)] rounded animate-pulse" />
      </div>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-[var(--bg-primary)] rounded-xl p-4 space-y-2 animate-pulse"
          >
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
            <div className="h-8 w-24 bg-[var(--border)] rounded" />
            <div className="h-3 w-20 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-48 bg-[var(--bg-primary)] rounded-xl animate-pulse" />

      {/* Breakdown skeleton */}
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-28 bg-[var(--bg-primary)] rounded" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-32 bg-[var(--bg-primary)] rounded" />
            <div className="h-3 w-full bg-[var(--bg-primary)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--text-muted)] mb-1">
        {label ? formatDateLabel(label) : ''}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.dataKey}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.dataKey === 'revenue' ? 'Revenue' : 'Costs'}:{' '}
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Cost Breakdown Bar ─────────────────────────────────

const COST_ITEMS = [
  { key: 'twilio' as const, label: 'Twilio', color: 'bg-blue-500' },
  { key: 'elevenlabs' as const, label: 'ElevenLabs', color: 'bg-purple-500' },
  { key: 'llm' as const, label: 'LLM', color: 'bg-amber-500' },
  { key: 'infra' as const, label: 'Infra', color: 'bg-cyan-500' },
];

function CostBreakdown({
  breakdown,
}: {
  breakdown: ProfitEngineData['breakdown'];
}) {
  const total =
    breakdown.twilio +
    breakdown.elevenlabs +
    breakdown.llm +
    breakdown.infra;

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-[var(--text-secondary)]">
        Cost Breakdown
      </p>
      {COST_ITEMS.map((item) => {
        const value = breakdown[item.key];
        const pct = total > 0 ? (value / total) * 100 : 0;
        return (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                {item.label}
              </span>
              <span className="text-[var(--text-muted)]">
                {pct.toFixed(0)}% ({formatCurrencyCompact(value)})
              </span>
            </div>
            <div className="h-2 w-full bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────

export function ProfitEngineWidget() {
  const { data, error, isLoading, mutate } = useSWR<ProfitEngineData>(
    '/api/metrics/profit-engine',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Compute week-over-week burn change from trend data
  const weekOverWeekBurn = useMemo(() => {
    if (!data?.trend || data.trend.length < 8) return null;
    const recent7 = data.trend.slice(-7);
    const prev7 = data.trend.slice(-14, -7);
    if (prev7.length === 0) return null;
    const recentAvg =
      recent7.reduce((s, d) => s + d.costs, 0) / recent7.length;
    const prevAvg = prev7.reduce((s, d) => s + d.costs, 0) / prev7.length;
    return recentAvg - prevAvg;
  }, [data]);

  if (isLoading) return <Skeleton />;

  if (error) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-sm">
              ⚠️ Failed to load profit metrics
            </span>
          </div>
          <button
            onClick={() => mutate()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const d = data ?? {
    current: { mrr: 0, totalBurn: 0, netMargin: 0, marginPercent: 0, subscribers: 0 },
    trend: [],
    breakdown: { twilio: 0, elevenlabs: 0, llm: 0, infra: 0 },
    lastUpdated: new Date().toISOString(),
  };

  const marginColor =
    d.current.marginPercent > 0
      ? 'text-emerald-400'
      : d.current.marginPercent < 0
      ? 'text-red-400'
      : 'text-purple-400';

  const lastUpdatedLabel = (() => {
    try {
      return formatDistanceToNow(new Date(d.lastUpdated), { addSuffix: true });
    } catch {
      return 'just now';
    }
  })();

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
          💰 Profit Engine
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          Updated {lastUpdatedLabel}
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Gross MRR */}
        <div className="bg-[var(--bg-primary)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">Gross MRR</p>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(d.current.mrr)}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            ■ {d.current.subscribers} subs
          </p>
        </div>

        {/* API Burn */}
        <div className="bg-[var(--bg-primary)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">API Burn</p>
          <p className="text-2xl font-bold text-red-400">
            {formatCurrency(d.current.totalBurn)}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {weekOverWeekBurn !== null ? (
              <>
                {weekOverWeekBurn >= 0 ? '▲' : '▼'}{' '}
                {weekOverWeekBurn >= 0 ? '+' : ''}
                {formatCurrency(weekOverWeekBurn)} WoW
              </>
            ) : (
              '—'
            )}
          </p>
        </div>

        {/* Net Margin */}
        <div className="bg-[var(--bg-primary)] rounded-xl p-4">
          <p className="text-xs text-[var(--text-muted)] mb-1">Net Margin</p>
          <p className={`text-2xl font-bold ${marginColor}`}>
            {d.current.marginPercent.toFixed(1)}%
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {formatCurrencyCompact(d.current.netMargin)} net
          </p>
        </div>
      </div>

      {/* Area Chart */}
      {d.trend.length > 1 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={d.trend}
              margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDateLabel}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#gradRevenue)"
              />
              <Area
                type="monotone"
                dataKey="costs"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#gradCosts)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cost Breakdown */}
      <CostBreakdown breakdown={d.breakdown} />
    </div>
  );
}
