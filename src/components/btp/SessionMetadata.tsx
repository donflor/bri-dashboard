'use client';

import { useState, useEffect, useCallback } from 'react';
import { BTP_TEST_ACCOUNTS } from '@/types/btp';
import type { BtpSession, BtpSessionStatus } from '@/types/btp';

interface Props {
  sessionId: string | null;
  testAccountId: string;
}

const STATUS_CONFIG: Record<BtpSessionStatus, { label: string; dot: string; bg: string; text: string }> = {
  pending: { label: 'Pending', dot: '◌', bg: 'bg-amber-900/50', text: 'text-amber-300' },
  running: { label: 'Running', dot: '●', bg: 'bg-indigo-900/50', text: 'text-indigo-300' },
  success: { label: 'Success', dot: '●', bg: 'bg-emerald-900/50', text: 'text-emerald-300' },
  failed: { label: 'Failed', dot: '●', bg: 'bg-red-900/50', text: 'text-red-300' },
  cancelled: { label: 'Cancelled', dot: '○', bg: 'bg-gray-800', text: 'text-gray-400' },
};

export default function SessionMetadata({ sessionId, testAccountId }: Props) {
  const [session, setSession] = useState<BtpSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const account = BTP_TEST_ACCOUNTS.find(a => a.id === testAccountId);

  const fetchSession = useCallback(async () => {
    if (!sessionId) { setSession(null); return; }
    try {
      const res = await fetch(`/api/btp/sessions?id=${sessionId}`, {
        headers: { 'X-BTP-Mode': 'sandbox' },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setSession(json.data);
      }
    } catch {
      // silently retry on next poll
    }
  }, [sessionId]);

  // Poll session data every 2s while active
  useEffect(() => {
    fetchSession();
    if (!sessionId) return;

    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [fetchSession, sessionId]);

  // Elapsed timer based on real started_at
  useEffect(() => {
    if (!session || !session.started_at) { setElapsed(0); return; }

    const startTime = new Date(session.started_at).getTime();

    if (session.ended_at) {
      const endTime = new Date(session.ended_at).getTime();
      setElapsed(Math.floor((endTime - startTime) / 1000));
      return;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const statusCfg = session?.status ? STATUS_CONFIG[session.status] : null;

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-white">Session Info</h3>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Test Account</span>
          <span className="text-xs font-medium text-white">{account?.name || testAccountId}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Phone</span>
          <span className="text-xs font-mono text-gray-300">{account?.phone || '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Email</span>
          <span className="text-xs font-mono text-gray-300 truncate ml-4">{account?.email || '—'}</span>
        </div>
        <div className="border-t border-gray-800 my-2" />
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Session ID</span>
          <span className="text-xs font-mono text-indigo-400 truncate ml-2">
            {sessionId ? sessionId.slice(0, 8) + '…' : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Scenario</span>
          <span className="text-xs font-medium text-white">{session?.scenario || '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Duration</span>
          <span className={`text-xs font-mono ${session ? 'text-emerald-400' : 'text-gray-500'}`}>
            {session ? formatTime(elapsed) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Status</span>
          {statusCfg ? (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
              {statusCfg.dot} {statusCfg.label}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-800 text-gray-500">
              ○ No session
            </span>
          )}
        </div>
        {session?.started_at && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Started</span>
            <span className="text-xs font-mono text-gray-300">
              {new Date(session.started_at).toLocaleTimeString()}
            </span>
          </div>
        )}
        {session?.ended_at && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Ended</span>
            <span className="text-xs font-mono text-gray-300">
              {new Date(session.ended_at).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
