'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow, format } from 'date-fns';

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500',
    thinking: 'bg-yellow-500 animate-pulse',
    idle: 'bg-gray-400',
    offline: 'bg-red-500',
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  const sizeClass = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <span className={`inline-block ${sizeClass} rounded-full ${colors[status] || 'bg-gray-400'}`} />
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

type TabType = 'status' | 'agents' | 'activity';

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { state, connected, refresh } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  // Require authentication
  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!session) {
      router.push('/login');
    }
  }, [session, authStatus, router]);

  if (authStatus === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header - Fixed */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🦾</span>
            <div>
              <h1 className="text-lg font-bold">Bri</h1>
              <div className="flex items-center gap-2 text-xs">
                <StatusBadge status={state.bri.status} />
                <span className="text-gray-400 capitalize">{state.bri.status}</span>
                {connected && <span className="text-green-500">• Live</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
                title="Admin"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
            )}
            <button
              onClick={refresh}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          
          {/* Status Tab Content */}
          {activeTab === 'status' && (
            <>
              {/* Big Status Card */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                      state.bri.status === 'active' ? 'bg-green-500/20' :
                      state.bri.status === 'thinking' ? 'bg-yellow-500/20' :
                      'bg-gray-700'
                    }`}>
                      🦾
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold capitalize">{state.bri.status}</h2>
                      <p className="text-gray-400">{state.bri.model}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{formatDuration(state.bri.uptime)}</p>
                    <p className="text-gray-400 text-sm">Uptime</p>
                  </div>
                </div>
                
                {state.bri.currentTask && (
                  <div className="bg-gray-900/50 rounded-2xl p-4">
                    <p className="text-gray-400 text-sm mb-1">Current Task</p>
                    <p className="text-white">{state.bri.currentTask}</p>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-3xl font-bold text-white">{state.stats.totalTasks24h}</p>
                  <p className="text-gray-400 text-xs mt-1">Tasks (24h)</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-3xl font-bold text-blue-400">{state.stats.activeSubAgents}</p>
                  <p className="text-gray-400 text-xs mt-1">Active Agents</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-3xl font-bold text-white">{(state.stats.avgResponseTime / 1000).toFixed(1)}s</p>
                  <p className="text-gray-400 text-xs mt-1">Avg Response</p>
                </div>
              </div>
            </>
          )}

          {/* Agents Tab Content */}
          {activeTab === 'agents' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-300 px-1">Sub-Agents</h2>
              {state.subAgents.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
                  <p className="text-gray-400">No sub-agents running</p>
                </div>
              ) : (
                state.subAgents.map((agent) => (
                  <div key={agent.sessionKey} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        agent.status === 'running' ? 'bg-blue-500/20' :
                        agent.status === 'completed' ? 'bg-green-500/20' :
                        agent.status === 'failed' ? 'bg-red-500/20' :
                        'bg-gray-800'
                      }`}>
                        <StatusBadge status={agent.status} size="lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{agent.label || agent.sessionKey}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            agent.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            agent.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            agent.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-800 text-gray-400'
                          }`}>
                            {agent.status}
                          </span>
                        </div>
                        {agent.task && (
                          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{agent.task}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-2">
                          Started {formatDistanceToNow(new Date(agent.startedAt))} ago
                          {agent.model && ` • ${agent.model}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Activity Tab Content */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-300 px-1">Recent Activity</h2>
              {state.recentActivity.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
                  <p className="text-gray-400">No recent activity</p>
                </div>
              ) : (
                state.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="bg-gray-900 rounded-xl p-4 border border-gray-800"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                        activity.status === 'success' ? 'bg-green-500' :
                        activity.status === 'error' ? 'bg-red-500' :
                        activity.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                        'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{format(new Date(activity.timestamp), 'HH:mm')}</span>
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
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Navigation - Fixed */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-2 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${
              activeTab === 'status' ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs font-medium">Status</span>
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors relative ${
              activeTab === 'agents' ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs font-medium">Agents</span>
            {state.stats.activeSubAgents > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                {state.stats.activeSubAgents}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors ${
              activeTab === 'activity' ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">Activity</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
