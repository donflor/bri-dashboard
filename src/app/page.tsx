'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow, format } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500',
    thinking: 'bg-yellow-500 animate-pulse',
    idle: 'bg-gray-400',
    offline: 'bg-red-500',
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[status] || 'bg-gray-400'}`} />
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
      connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      {connected ? 'Live' : 'Disconnected'}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export default function Dashboard() {
  const { state, connected, error, refresh } = useWebSocket();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl">🦾</span>
          <div>
            <h1 className="text-2xl font-bold">Bri Status</h1>
            <p className="text-gray-400 text-sm">Real-time dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ConnectionStatus connected={connected} />
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Demo Mode Banner */}
      {!process.env.NEXT_PUBLIC_GATEWAY_CONNECTED && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center gap-3">
          <span className="text-xl">🎮</span>
          <div>
            <p className="font-medium">Demo Mode</p>
            <p className="text-sm text-yellow-500/80">Showing simulated data. Connect to OpenClaw gateway for live updates.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Main Status Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-300">Status</h2>
            <StatusBadge status={state.bri.status} />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">State</span>
              <span className="font-medium capitalize">{state.bri.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Model</span>
              <span className="font-mono text-sm text-blue-400">{state.bri.model}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Uptime</span>
              <span>{formatDuration(state.bri.uptime)}</span>
            </div>
            {state.bri.currentTask && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-gray-500 text-sm mb-1">Current task</p>
                <p className="text-sm truncate">{state.bri.currentTask}</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Stats (24h)</h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-500 text-sm">Tasks Completed</p>
              <p className="text-3xl font-bold">{state.stats.totalTasks24h}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Active Sub-agents</p>
              <p className="text-3xl font-bold text-blue-400">{state.stats.activeSubAgents}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Avg Response Time</p>
              <p className="text-3xl font-bold">{(state.stats.avgResponseTime / 1000).toFixed(1)}s</p>
            </div>
          </div>
        </div>

        {/* Sub-agents Card */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 md:col-span-2 lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Sub-agents</h2>
          {state.subAgents.length === 0 ? (
            <p className="text-gray-500 text-sm">No active sub-agents</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {state.subAgents.map((agent) => (
                <div key={agent.sessionKey} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/50">
                  <StatusBadge status={agent.status} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {agent.label || agent.sessionKey}
                    </p>
                    {agent.task && (
                      <p className="text-gray-400 text-xs truncate">{agent.task}</p>
                    )}
                    <p className="text-gray-500 text-xs mt-1">
                      Started {formatDistanceToNow(new Date(agent.startedAt))} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Recent Activity</h2>
        {state.recentActivity.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {state.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
              >
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  activity.status === 'success' ? 'bg-green-500' :
                  activity.status === 'error' ? 'bg-red-500' :
                  activity.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                  'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{format(new Date(activity.timestamp), 'HH:mm:ss')}</span>
                    <span>•</span>
                    <span className="capitalize">{activity.type}</span>
                    {activity.duration && (
                      <>
                        <span>•</span>
                        <span>{(activity.duration / 1000).toFixed(1)}s</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-gray-600 text-sm">
        Last updated: {format(new Date(state.lastUpdated), 'PPpp')}
      </footer>
    </div>
  );
}
