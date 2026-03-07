'use client';

import { useState } from 'react';
import TestAccountSelector from './TestAccountSelector';
import TwilioSoftphone from './TwilioSoftphone';
import SMSChatPanel from './SMSChatPanel';
import EmailFeedPanel from './EmailFeedPanel';
import TestPlaybook from './TestPlaybook';
import SessionMetadata from './SessionMetadata';
import { AgentLogStream } from '@/components/AgentLogStream';

export default function GlasshouseLayout() {
  const [selectedAccount, setSelectedAccount] = useState('btp_tester_1');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white">BMC Testing Interface</h2>
          </div>
          <span className="text-xs text-amber-400/70 bg-amber-950/30 border border-amber-800/30 rounded-full px-3 py-1">
            SANDBOX MODE
          </span>
        </div>
        <TestAccountSelector
          selected={selectedAccount}
          onSelect={setSelectedAccount}
          className="w-64"
        />
      </div>

      {/* Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Pane — Human UX (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <TwilioSoftphone testAccountId={selectedAccount} />
          <SMSChatPanel testAccountId={selectedAccount} />
          <EmailFeedPanel testAccountId={selectedAccount} />
        </div>

        {/* Right Pane — AI Telemetry (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <SessionMetadata sessionId={activeSessionId} testAccountId={selectedAccount} />
          
          {/* Agent Log Stream with BTP session filter */}
          <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-semibold text-white">AI Agent Telemetry</h3>
              {activeSessionId && (
                <span className="text-[10px] text-indigo-400 bg-indigo-950/50 rounded-full px-2 py-0.5">
                  Filtered: {activeSessionId.slice(0, 8)}...
                </span>
              )}
            </div>
            <div className="bg-gray-950 rounded-lg p-3 font-mono text-xs text-gray-300 h-[400px] overflow-y-auto">
              <AgentLogStream />
            </div>
          </div>
        </div>
      </div>

      {/* Test Playbook — Full Width Bottom */}
      <TestPlaybook
        testAccountId={selectedAccount}
        onSessionCreated={setActiveSessionId}
      />
    </div>
  );
}
