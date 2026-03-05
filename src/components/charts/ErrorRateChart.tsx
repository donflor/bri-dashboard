'use client';

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ActivityItem } from '@/types/dashboard';

interface ErrorRateChartProps {
  activities: ActivityItem[];
  hours?: number;
}

export function ErrorRateChart({ activities, hours = 24 }: ErrorRateChartProps) {
  const data = useMemo(() => {
    const now = Date.now();
    const bucketCount = Math.min(hours, 24);
    const bucketMs = (hours * 3600000) / bucketCount;
    const cutoff = now - hours * 3600000;

    const buckets: { time: string; errors: number; total: number; rate: number }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = cutoff + i * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const inBucket = activities.filter(a => {
        const ts = new Date(a.timestamp).getTime();
        return ts >= bucketStart && ts < bucketEnd;
      });
      const errors = inBucket.filter(a => a.status === 'error').length;
      const total = inBucket.length;
      const h = new Date(bucketStart).getHours();
      const m = new Date(bucketStart).getMinutes();
      buckets.push({
        time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        errors,
        total,
        rate: total > 0 ? parseFloat(((errors / total) * 100).toFixed(1)) : 0,
      });
    }
    return buckets;
  }, [activities, hours]);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)]">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Error Rate</h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} unit="%" />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}
              formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Error Rate']}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#ef4444"
              fill="url(#errorGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
