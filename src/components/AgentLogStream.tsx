'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'tool';
  message: string;
}

const AGENT_COLORS: Record<string, string> = {
  product_engineer: '#60a5fa', // blue
  ux_architect: '#f472b6',    // pink
  qa_lead: '#a78bfa',         // purple
  closer: '#fbbf24',          // amber
  daba: '#34d399',            // emerald
  seesee: '#fb923c',          // orange
  it_ops: '#94a3b8',          // slate
  router_agent: '#2dd4bf',    // teal
  ceo_bri: '#f87171',         // red
  system: '#6b7280',          // gray
};

const LEVEL_STYLES: Record<string, { prefix: string; color: string }> = {
  info: { prefix: 'INF', color: '#60a5fa' },
  warn: { prefix: 'WRN', color: '#fbbf24' },
  error: { prefix: 'ERR', color: '#f87171' },
  debug: { prefix: 'DBG', color: '#6b7280' },
  tool: { prefix: 'TUL', color: '#a78bfa' },
};

const MAX_LINES = 500;
const ALL_AGENTS = 'all';

export function AgentLogStream() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterAgent, setFilterAgent] = useState(ALL_AGENTS);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef(false);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => {
      const next = [...prev, entry];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }, []);

  useEffect(() => {
    const es = new EventSource('/api/stream');

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener('agent_log', (e) => {
      try {
        const data = JSON.parse(e.data);
        addLog({
          id: data.id || `${Date.now()}-${Math.random()}`,
          timestamp: data.timestamp || new Date().toISOString(),
          agent: data.agent || 'system',
          level: data.level || 'info',
          message: data.message || '',
        });
      } catch { /* ignore */ }
    });

    // Also capture activity events as logs
    es.addEventListener('activity', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.payload) {
          addLog({
            id: data.payload.id || `${Date.now()}-${Math.random()}`,
            timestamp: data.timestamp || new Date().toISOString(),
            agent: data.payload.source?.user || 'system',
            level: data.payload.status === 'error' ? 'error' : 'info',
            message: data.payload.description || JSON.stringify(data.payload),
          });
        }
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, [addLog]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !scrollLockRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    scrollLockRef.current = !atBottom;
    if (atBottom) setAutoScroll(true);
  };

  const filteredLogs = filterAgent === ALL_AGENTS
    ? logs
    : logs.filter(l => l.agent === filterAgent);

  const uniqueAgents = [...new Set(logs.map(l => l.agent))].sort();

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Agent Logs</h2>
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-[var(--text-muted)]">{filteredLogs.length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
          >
            <option value={ALL_AGENTS}>All Agents</option>
            {uniqueAgents.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={() => { setAutoScroll(!autoScroll); scrollLockRef.current = autoScroll; }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoScroll
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
            }`}
          >
            {autoScroll ? '⬇ Auto-scroll' : '⏸ Paused'}
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#0d1117] rounded-2xl border border-[var(--border-color)] font-mono text-xs overflow-y-auto"
        style={{ height: '500px' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <div className="text-3xl mb-2">📡</div>
              <div>Waiting for agent logs...</div>
              <div className="text-[10px] mt-1">Logs stream in real-time via SSE</div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {filteredLogs.map((log) => {
              const levelStyle = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
              const agentColor = AGENT_COLORS[log.agent] || '#6b7280';
              return (
                <div key={log.id} className="flex gap-2 leading-5 hover:bg-white/5 px-1 rounded">
                  <span className="text-gray-600 shrink-0">{formatTime(log.timestamp)}</span>
                  <span className="shrink-0 font-bold" style={{ color: levelStyle.color }}>[{levelStyle.prefix}]</span>
                  <span className="shrink-0 font-semibold" style={{ color: agentColor }}>{log.agent}</span>
                  <span className="text-gray-300 break-all">{log.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
