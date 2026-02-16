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
    error: 'bg-red-500',
    pending: 'bg-yellow-500 animate-pulse',
    in_progress: 'bg-blue-500 animate-pulse',
    scheduled: 'bg-purple-500',
    success: 'bg-green-500',
    info: 'bg-blue-400',
  };

  const sizeClass = size === 'lg' ? 'w-4 h-4' : 'w-2.5 h-2.5';

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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-400',
    success: 'text-green-400',
    running: 'text-blue-400',
    in_progress: 'text-blue-400',
    pending: 'text-yellow-400',
    error: 'text-red-400',
    failed: 'text-red-400',
    info: 'text-blue-300',
  };
  return colors[status] || 'text-gray-400';
}

type TabType = 'status' | 'cron' | 'agents' | 'activity';

export default function Dashboard() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { state, connected, refresh } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🦾</span>
            <div>
              <h1 className="text-lg font-bold">Bri Mission Control</h1>
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          
          {/* Status Tab */}
          {activeTab === 'status' && (
            <>
              {/* Status Card */}
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
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-2xl font-bold text-white">{state.stats.totalTasks24h}</p>
                  <p className="text-gray-400 text-xs mt-1">Tasks (24h)</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-2xl font-bold text-purple-400">{state.stats.activeCronJobs || 0}</p>
                  <p className="text-gray-400 text-xs mt-1">Cron Active</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-2xl font-bold text-blue-400">{state.stats.activeSubAgents}</p>
                  <p className="text-gray-400 text-xs mt-1">Sub-Agents</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-4 text-center border border-gray-800">
                  <p className="text-2xl font-bold text-white">
                    {state.stats.avgResponseTime > 0 ? `${(state.stats.avgResponseTime / 1000).toFixed(1)}s` : '-'}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">Avg Response</p>
                </div>
              </div>

              {/* Quick Activity Preview */}
              <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h3>
                <div className="space-y-2">
                  {state.recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 text-sm">
                      <StatusBadge status={activity.status} />
                      <div className="flex-1 min-w-0">
                        <p className={`truncate ${getStatusColor(activity.status)}`}>
                          {activity.description}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Cron Jobs Tab */}
          {activeTab === 'cron' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-300 px-1">Cron Jobs</h2>
              {(!state.cronJobs || state.cronJobs.length === 0) ? (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
                  <p className="text-gray-400">No cron jobs found</p>
                </div>
              ) : (
                state.cronJobs.map((job) => (
                  <div key={job.id} className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        job.status === 'running' ? 'bg-blue-500/20' :
                        job.status === 'completed' ? 'bg-green-500/20' :
                        job.status === 'error' ? 'bg-red-500/20' :
                        'bg-purple-500/20'
                      }`}>
                        <span className="text-lg">⏰</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold truncate">{job.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            job.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            job.status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        {job.result && (
                          <p className="text-gray-400 text-sm line-clamp-2">{job.result}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          Last run: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub-Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-300 px-1">Sub-Agents</h2>
              {state.subAgents.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
                  <p className="text-gray-400">No sub-agents running</p>
                  <p className="text-gray-500 text-sm mt-2">Sub-agents are spawned for complex background tasks</p>
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

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-300 px-1">Activity Log</h2>
              {state.recentActivity.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
                  <p className="text-gray-400">No recent activity</p>
                </div>
              ) : (
                state.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className={`bg-gray-900 rounded-xl p-4 border ${
                      activity.status === 'pending' || activity.status === 'in_progress' 
                        ? 'border-yellow-500/30' 
                        : activity.status === 'error' 
                          ? 'border-red-500/30'
                          : 'border-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <StatusBadge status={activity.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            activity.type === 'cron' ? 'bg-purple-500/20 text-purple-400' :
                            activity.type === 'message' ? 'bg-blue-500/20 text-blue-400' :
                            activity.type === 'subagent' ? 'bg-cyan-500/20 text-cyan-400' :
                            activity.type === 'incoming' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {activity.type}
                          </span>
                          <span className={`text-xs ${getStatusColor(activity.status)}`}>
                            {activity.status}
                          </span>
                        </div>
                        <p className="text-sm text-white">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{format(new Date(activity.timestamp), 'HH:mm:ss')}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
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

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-2 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-around">
          {[
            { id: 'status', icon: '📊', label: 'Status' },
            { id: 'cron', icon: '⏰', label: 'Cron', badge: state.cronJobs?.length || 0 },
            { id: 'agents', icon: '🤖', label: 'Agents', badge: state.stats.activeSubAgents },
            { id: 'activity', icon: '📋', label: 'Activity' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative ${
                activeTab === tab.id ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
