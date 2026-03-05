'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ActivityItem } from '@/types/dashboard';

interface ActivityBarChartProps {
  activities: ActivityItem[];
  hours?: number;
}

export function ActivityBarChart({ activities, hours = 24 }: ActivityBarChartProps) {
  const data = useMemo(() => {
    const now = Date.now();
    const bucketCount = Math.min(hours, 24);
    const bucketMs = (hours * 3600000) / bucketCount;
    const cutoff = now - hours * 3600000;

    const buckets: { time: string; success: number; errors: number }[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = cutoff + i * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const inBucket = activities.filter(a => {
        const ts = new Date(a.timestamp).getTime();
        return ts >= bucketStart && ts < bucketEnd;
      });
      const errors = inBucket.filter(a => a.status === 'error').length;
      const success = inBucket.length - errors;
      const h = new Date(bucketStart).getHours();
      const m = new Date(bucketStart).getMinutes();
      buckets.push({
        time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        success,
        errors,
      });
    }
    return buckets;
  }, [activities, hours]);

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border)]">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
        Activity Timeline ({hours}h)
      </h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--text-primary)',
              }}
            />
            <Bar dataKey="success" stackId="a" fill="var(--accent)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="errors" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
