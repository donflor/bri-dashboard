'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { DashboardState, WebSocketMessage } from '@/types/dashboard';

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
  const socketRef = useRef<Socket | null>(null);

  const refresh = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('refresh');
    }
  }, []);

  useEffect(() => {
    // Determine WebSocket URL based on current location
    const wsUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
      : '';

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
      setError(`Connection error: ${err.message}`);
    });

    socket.on('status_update', (message: WebSocketMessage) => {
      if (message.type === 'full_sync') {
        setState(message.payload as DashboardState);
      } else if (message.type === 'status_update') {
        setState(prev => ({
          ...prev,
          bri: { ...prev.bri, ...(message.payload as Partial<DashboardState['bri']>) },
          lastUpdated: message.timestamp,
        }));
      } else if (message.type === 'activity') {
        setState(prev => ({
          ...prev,
          recentActivity: [message.payload as DashboardState['recentActivity'][0], ...prev.recentActivity].slice(0, 50),
          lastUpdated: message.timestamp,
        }));
      } else if (message.type === 'subagent_update') {
        setState(prev => {
          const agent = message.payload as DashboardState['subAgents'][0];
          const existing = prev.subAgents.findIndex(s => s.sessionKey === agent.sessionKey);
          const newAgents = [...prev.subAgents];
          if (existing >= 0) {
            newAgents[existing] = agent;
          } else {
            newAgents.unshift(agent);
          }
          return {
            ...prev,
            subAgents: newAgents,
            lastUpdated: message.timestamp,
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { state, connected, error, refresh };
}
