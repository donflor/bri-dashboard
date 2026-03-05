'use client';

import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { DashboardState } from '@/types/dashboard';
import { ThemeToggle } from '@/components/ThemeToggle';
import EnvironmentToggle from '@/components/btp/EnvironmentToggle';
import { useEnvironment } from '@/contexts/EnvironmentContext';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

interface InfraHeaderProps {
  state: DashboardState;
  connected: boolean;
  onRefresh: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
}

export function InfraHeader({ state, connected, onRefresh, isAdmin, onAdminClick }: InfraHeaderProps) {
  const { isSandbox } = useEnvironment();

  return (
    <div className={clsx(
      'flex items-center justify-between px-4 h-12 bg-[var(--bg-card)] border-b border-[var(--border)] flex-shrink-0',
      isSandbox && 'border-t-[3px] border-t-amber-500'
    )}>
      {/* Left: Connection + Uptime + Model */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-500 animate-live-pulse' : 'bg-red-500')} />
          <span className={clsx('font-medium', connected ? 'text-green-400' : 'text-red-400')}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[var(--text-muted)]">
          <span>⏱</span>
          <span>{formatUptime(state.bri.uptime)}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1">
          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] font-mono text-[11px]">
            {state.bri.model}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[var(--text-muted)]">
          <span>Last sync:</span>
          <span>{formatDistanceToNow(new Date(state.lastUpdated), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Right: Env toggle + Theme + Admin + Refresh */}
      <div className="flex items-center gap-2">
        <EnvironmentToggle />
        {isSandbox && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
            ⚠️ SANDBOX
          </span>
        )}
        <ThemeToggle />
        {isAdmin && onAdminClick && (
          <button onClick={onAdminClick}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
            title="Admin">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
        )}
        <button onClick={onRefresh}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
          title="Refresh (R)">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
