'use client';

import { useState, useEffect } from 'react';
import { BTP_TEST_ACCOUNTS } from '@/types/btp';

interface Props {
  sessionId: string | null;
  testAccountId: string;
}

export default function SessionMetadata({ sessionId, testAccountId }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const account = BTP_TEST_ACCOUNTS.find(a => a.id === testAccountId);

  useEffect(() => {
    if (!sessionId) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`
      : `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

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
          <span className="text-xs font-mono text-indigo-400 truncate ml-2">{sessionId || '—'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Duration</span>
          <span className={`text-xs font-mono ${sessionId ? 'text-emerald-400' : 'text-gray-500'}`}>
            {sessionId ? formatTime(elapsed) : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Status</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            sessionId ? 'bg-emerald-900/50 text-emerald-300' : 'bg-gray-800 text-gray-500'
          }`}>
            {sessionId ? '● Active' : '○ No session'}
          </span>
        </div>
      </div>
    </div>
  );
}
