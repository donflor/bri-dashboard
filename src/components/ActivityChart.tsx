'use client';
import type { ActivityItem } from '@/types/dashboard';

interface ActivityChartProps {
  activities: ActivityItem[];
  hours?: number;
}

export function ActivityChart({ activities, hours = 24 }: ActivityChartProps) {
  const now = Date.now();
  const bucketCount = Math.min(hours, 24);
  const bucketMs = (hours * 3600000) / bucketCount;
  const cutoff = now - hours * 3600000;

  const buckets = new Array(bucketCount).fill(0);
  const errorBuckets = new Array(bucketCount).fill(0);

  activities.forEach(a => {
    const ts = new Date(a.timestamp).getTime();
    if (ts < cutoff) return;
    const idx = Math.min(Math.floor((ts - cutoff) / bucketMs), bucketCount - 1);
    buckets[idx]++;
    if (a.status === 'error') errorBuckets[idx]++;
  });

  const max = Math.max(...buckets, 1);
  const barWidth = 100 / bucketCount;
  const svgHeight = 80;

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
        Activity ({hours}h)
      </h3>
      <svg viewBox={`0 0 100 ${svgHeight}`} className="w-full h-20" preserveAspectRatio="none">
        {buckets.map((count, i) => {
          const h = (count / max) * (svgHeight - 4);
          const errH = (errorBuckets[i] / max) * (svgHeight - 4);
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.1}
                y={svgHeight - h}
                width={barWidth * 0.8}
                height={h}
                fill="var(--accent)"
                opacity="0.6"
                rx="0.5"
              />
              {errH > 0 && (
                <rect
                  x={i * barWidth + barWidth * 0.1}
                  y={svgHeight - errH}
                  width={barWidth * 0.8}
                  height={errH}
                  fill="#ef4444"
                  opacity="0.8"
                  rx="0.5"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
        <span>{hours}h ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}
