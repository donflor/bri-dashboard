'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import clsx from 'clsx';

// Mock data — will be wired to Stripe / API cost APIs later
const MOCK_MRR_TREND = [
  { day: 'Mon', mrr: 0 },
  { day: 'Tue', mrr: 0 },
  { day: 'Wed', mrr: 0 },
  { day: 'Thu', mrr: 0 },
  { day: 'Fri', mrr: 0 },
  { day: 'Sat', mrr: 0 },
  { day: 'Sun', mrr: 0 },
];

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: string;
  trend?: 'up' | 'down' | 'stable';
}

function MetricCard({ title, value, subtitle, icon, color, trend }: MetricCardProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border)]">
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg', color)}>
          {icon}
        </div>
        {trend && (
          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full',
            trend === 'up' ? 'bg-green-500/10 text-green-400' :
            trend === 'down' ? 'bg-red-500/10 text-red-400' :
            'bg-gray-500/10 text-[var(--text-muted)]'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{title}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{subtitle}</p>
    </div>
  );
}

export function ProfitEngine() {
  const mrrData = useMemo(() => MOCK_MRR_TREND, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">💰 Profit Engine</h2>
        <p className="text-sm text-[var(--text-muted)]">Friday Profit Audit · Weekly P&amp;L Snapshot</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          title="Weekly MRR"
          value="$0"
          subtitle="Stripe · Awaiting first customer"
          icon="💳"
          color="bg-green-500/15"
          trend="stable"
        />
        <MetricCard
          title="API Costs"
          value="$0"
          subtitle="Twilio + ElevenLabs + LLM"
          icon="🔥"
          color="bg-red-500/15"
          trend="stable"
        />
        <MetricCard
          title="Net Margin"
          value="$0"
          subtitle="MRR minus API burn"
          icon="📈"
          color="bg-blue-500/15"
          trend="stable"
        />
      </div>

      {/* MRR Trend Chart */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">MRR Trend (7-day)</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mrrData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                formatter={(value: number | undefined) => [`$${value ?? 0}`, 'MRR']}
              />
              <Line type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Cost Breakdown</h3>
        <div className="space-y-3">
          {[
            { name: 'Twilio (Voice + SMS)', cost: '$0.00', pct: 0 },
            { name: 'ElevenLabs (TTS)', cost: '$0.00', pct: 0 },
            { name: 'LLM API (Claude/GPT)', cost: '$0.00', pct: 0 },
            { name: 'Infrastructure (DO)', cost: '$0.00', pct: 0 },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-[var(--text-secondary)]">{item.name}</p>
                  <p className="text-xs font-mono text-[var(--text-muted)]">{item.cost}</p>
                </div>
                <div className="h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder note */}
      <div className="bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] text-center">
          📊 Data wiring pending — Stripe, Twilio, ElevenLabs, and LLM cost APIs will populate these metrics automatically.
        </p>
      </div>
    </div>
  );
}
