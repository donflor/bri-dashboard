'use client';
import { useEffect, useRef } from 'react';
import type { ActivityItem, SubAgent } from '@/types/dashboard';
import { format, formatDistanceToNow } from 'date-fns';

type SheetData = { type: 'activity'; data: ActivityItem } | { type: 'agent'; data: SubAgent } | null;

interface BottomSheetProps {
  item: SheetData;
  onClose: () => void;
}

export function BottomSheet({ item, onClose }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={ref}
        className="relative w-full max-h-[70vh] bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl p-6 animate-slide-up overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--text-muted)] rounded-full mx-auto mb-4" />
        {item.type === 'activity' ? (
          <ActivityDetail activity={item.data} />
        ) : (
          <AgentDetail agent={item.data} />
        )}
      </div>
    </div>
  );
}

function ActivityDetail({ activity }: { activity: ActivityItem }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-xs ${
          activity.type === 'cron' ? 'bg-purple-500/20 text-purple-400' :
          activity.type === 'message' ? 'bg-blue-500/20 text-blue-400' :
          activity.type === 'subagent' ? 'bg-cyan-500/20 text-cyan-400' :
          'bg-gray-700 text-gray-400'
        }`}>{activity.type}</span>
        <span className="text-xs text-[var(--text-muted)]">{activity.status}</span>
      </div>
      <p className="text-lg font-semibold">{activity.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[var(--text-muted)]">Time</p>
          <p>{format(new Date(activity.timestamp), 'MMM d, HH:mm:ss')}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)]">Relative</p>
          <p>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</p>
        </div>
        {activity.duration && (
          <div>
            <p className="text-[var(--text-muted)]">Duration</p>
            <p>{(activity.duration / 1000).toFixed(1)}s</p>
          </div>
        )}
        {activity.sourceDisplay && (
          <div>
            <p className="text-[var(--text-muted)]">Source</p>
            <p>{activity.sourceDisplay}</p>
          </div>
        )}
      </div>
      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
        <div>
          <p className="text-[var(--text-muted)] text-sm mb-1">Metadata</p>
          <pre className="text-xs bg-[var(--bg-primary)] rounded-xl p-3 overflow-x-auto">
            {JSON.stringify(activity.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AgentDetail({ agent }: { agent: SubAgent }) {
  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold">{agent.label || agent.sessionKey}</p>
      <span className={`px-2 py-0.5 rounded-full text-xs ${
        agent.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
        agent.status === 'completed' ? 'bg-green-500/20 text-green-400' :
        'bg-red-500/20 text-red-400'
      }`}>{agent.status}</span>
      {agent.task && <p className="text-sm text-[var(--text-secondary)]">{agent.task}</p>}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[var(--text-muted)]">Started</p>
          <p>{format(new Date(agent.startedAt), 'MMM d, HH:mm:ss')}</p>
        </div>
        {agent.model && (
          <div>
            <p className="text-[var(--text-muted)]">Model</p>
            <p>{agent.model}</p>
          </div>
        )}
        {agent.sourceDisplay && (
          <div>
            <p className="text-[var(--text-muted)]">Source</p>
            <p>{agent.sourceDisplay}</p>
          </div>
        )}
      </div>
    </div>
  );
}
