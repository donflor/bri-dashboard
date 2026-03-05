'use client';

import { useState, useCallback } from 'react';
import type { BtpScenario, BtpSessionStatus } from '@/types/btp';

interface Props {
  testAccountId: string;
  onSessionCreated?: (sessionId: string) => void;
}

interface ScenarioConfig {
  id: BtpScenario;
  label: string;
  icon: string;
  description: string;
  color: string;
}

const SCENARIOS: ScenarioConfig[] = [
  { id: 'magic-demo', label: 'Magic Demo → T1', icon: '✨', description: 'Trigger ElevenLabs demo flow', color: 'indigo' },
  { id: 'enterprise-escalation', label: 'Enterprise Escalation', icon: '🏢', description: 'Simulate enterprise-tier lead', color: 'purple' },
  { id: 'winback-sms', label: 'T+24h Winback SMS', icon: '💬', description: 'Fire win-back SMS sequence', color: 'amber' },
  { id: 'winback-call', label: 'T+12h Winback Call', icon: '📞', description: 'Fire win-back voice call', color: 'rose' },
  { id: 'inbound-call', label: 'Inbound Call Sim', icon: '📲', description: 'Simulate inbound test call', color: 'emerald' },
  { id: 'sms-reply', label: 'SMS Reply Test', icon: '💬', description: 'Simulate inbound SMS reply', color: 'cyan' },
  { id: 'email-reply', label: 'Email Reply Test', icon: '📧', description: 'Simulate inbound email reply', color: 'blue' },
];

const STATUS_STYLES: Record<BtpSessionStatus | 'idle', string> = {
  idle: 'bg-gray-800 hover:bg-gray-700 border-gray-700',
  pending: 'bg-amber-950/30 border-amber-600/40 animate-pulse',
  running: 'bg-indigo-950/30 border-indigo-600/40 animate-pulse',
  success: 'bg-emerald-950/30 border-emerald-600/40',
  failed: 'bg-red-950/30 border-red-600/40',
  cancelled: 'bg-gray-800 border-gray-600',
};

export default function TestPlaybook({ testAccountId, onSessionCreated }: Props) {
  const [statuses, setStatuses] = useState<Record<string, BtpSessionStatus | 'idle'>>(
    Object.fromEntries(SCENARIOS.map(s => [s.id, 'idle']))
  );

  const triggerScenario = useCallback(async (scenario: BtpScenario) => {
    if (statuses[scenario] === 'running' || statuses[scenario] === 'pending') return;

    setStatuses(prev => ({ ...prev, [scenario]: 'pending' }));

    try {
      const res = await fetch(`/api/btp/trigger/${scenario}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BTP-Mode': 'sandbox' },
        body: JSON.stringify({ testAccountId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatuses(prev => ({ ...prev, [scenario]: 'running' }));
        if (data.sessionId) onSessionCreated?.(data.sessionId);

        // Auto-transition to success after 10s (simulated; real impl would use WebSocket)
        setTimeout(() => {
          setStatuses(prev => ({ ...prev, [scenario]: 'success' }));
          setTimeout(() => setStatuses(prev => ({ ...prev, [scenario]: 'idle' })), 5000);
        }, 10000);
      } else {
        setStatuses(prev => ({ ...prev, [scenario]: 'failed' }));
        setTimeout(() => setStatuses(prev => ({ ...prev, [scenario]: 'idle' })), 5000);
      }
    } catch {
      setStatuses(prev => ({ ...prev, [scenario]: 'failed' }));
      setTimeout(() => setStatuses(prev => ({ ...prev, [scenario]: 'idle' })), 5000);
    }
  }, [testAccountId, statuses, onSessionCreated]);

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="text-sm font-semibold text-white">Test Playbook — One-Click Scenarios</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SCENARIOS.map((scenario) => {
          const status = statuses[scenario.id];
          return (
            <button
              key={scenario.id}
              onClick={() => triggerScenario(scenario.id)}
              disabled={status === 'running' || status === 'pending'}
              className={`
                relative rounded-lg border px-3 py-3 text-left transition-all duration-200
                disabled:cursor-not-allowed
                ${STATUS_STYLES[status]}
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{scenario.icon}</span>
                <span className="text-xs font-medium text-white leading-tight">{scenario.label}</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">{scenario.description}</p>
              
              {/* Status Badge */}
              {status !== 'idle' && (
                <span className={`
                  absolute top-2 right-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium
                  ${status === 'pending' ? 'bg-amber-900 text-amber-300' : ''}
                  ${status === 'running' ? 'bg-indigo-900 text-indigo-300' : ''}
                  ${status === 'success' ? 'bg-emerald-900 text-emerald-300' : ''}
                  ${status === 'failed' ? 'bg-red-900 text-red-300' : ''}
                `}>
                  {status}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
