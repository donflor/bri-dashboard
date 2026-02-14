'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { DashboardState } from '@/types/dashboard';

const INITIAL_STATE: DashboardState = {
  bri: {
    status: 'offline',
    model: 'claude-opus-4-5',
    sessionKey: 'main',
    uptime: 0,
    lastActivity: new Date().toISOString(),
  },
  subAgents: [],
  recentActivity: [],
  stats: {
    totalTasks24h: 0,
    activeSubAgents: 0,
    avgResponseTime: 0,
  },
  lastUpdated: new Date().toISOString(),
};

export function useWebSocket() {
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource('/api/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connected');
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as DashboardState;
        setState(data);
      } catch (e) {
        console.error('Failed to parse SSE data:', e);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      setConnected(false);
      setError('Connection lost. Reconnecting...');
      eventSource.close();

      // Reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, []);

  const refresh = useCallback(() => {
    // Reconnect to get fresh data
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return { state, connected, error, refresh };
}
