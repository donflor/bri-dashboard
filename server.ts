import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type { DashboardState } from './src/types/dashboard';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// OpenClaw Gateway config
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:3033';
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';

async function fetchStatus(): Promise<DashboardState | null> {
  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const sessions = data.sessions || [];
    const now = new Date().toISOString();
    
    const mainSession = sessions.find((s: Record<string, unknown>) => s.kind === 'main') || sessions[0];
    const subAgentSessions = sessions.filter((s: Record<string, unknown>) => 
      s.kind === 'isolated' || s.kind === 'subagent'
    );
    
    return {
      bri: {
        status: mainSession?.state === 'running' ? 'active' : 
                mainSession?.state === 'thinking' ? 'thinking' : 'idle',
        currentTask: mainSession?.lastMessage?.slice(0, 100),
        model: mainSession?.model || 'claude-opus-4-5',
        sessionKey: mainSession?.sessionKey || 'main',
        uptime: mainSession?.createdAt 
          ? Math.floor((Date.now() - new Date(mainSession.createdAt).getTime()) / 1000)
          : 0,
        lastActivity: mainSession?.lastActivityAt || now,
      },
      subAgents: subAgentSessions.map((s: Record<string, unknown>) => ({
        sessionKey: s.sessionKey as string,
        label: s.label as string | undefined,
        status: s.state === 'running' ? 'running' as const : 
                s.state === 'completed' ? 'completed' as const : 
                s.state === 'failed' ? 'failed' as const : 'idle' as const,
        task: (s.task as string | undefined) || (s.lastMessage as string | undefined)?.slice(0, 100),
        startedAt: s.createdAt as string || now,
        completedAt: s.completedAt as string | undefined,
        model: s.model as string | undefined,
      })),
      recentActivity: [],
      stats: {
        totalTasks24h: 0,
        activeSubAgents: subAgentSessions.filter((s: Record<string, unknown>) => s.state === 'running').length,
        avgResponseTime: 1200,
      },
      lastUpdated: now,
    };
  } catch (error) {
    console.error('Status fetch error:', error);
    return null;
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || '', true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  });

  // Track connected clients
  let clientCount = 0;
  let pollInterval: NodeJS.Timeout | null = null;
  let lastState: DashboardState | null = null;

  const startPolling = () => {
    if (pollInterval) return;
    
    console.log('Starting status polling...');
    pollInterval = setInterval(async () => {
      const status = await fetchStatus();
      if (status) {
        // Only emit if state changed
        const stateChanged = JSON.stringify(status) !== JSON.stringify(lastState);
        if (stateChanged) {
          lastState = status;
          io.emit('status_update', {
            type: 'full_sync',
            payload: status,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const stopPolling = () => {
    if (pollInterval && clientCount === 0) {
      console.log('Stopping status polling (no clients)');
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  io.on('connection', async (socket) => {
    clientCount++;
    console.log(`Client connected (${clientCount} total)`);
    
    // Start polling if first client
    startPolling();
    
    // Send initial state
    const initialStatus = await fetchStatus();
    if (initialStatus) {
      lastState = initialStatus;
      socket.emit('status_update', {
        type: 'full_sync',
        payload: initialStatus,
        timestamp: new Date().toISOString(),
      });
    }

    socket.on('disconnect', () => {
      clientCount--;
      console.log(`Client disconnected (${clientCount} remaining)`);
      
      // Stop polling if no clients
      if (clientCount === 0) {
        setTimeout(stopPolling, 5000); // Wait 5s before stopping
      }
    });

    // Allow clients to request refresh
    socket.on('refresh', async () => {
      const status = await fetchStatus();
      if (status) {
        socket.emit('status_update', {
          type: 'full_sync',
          payload: status,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Bri Dashboard ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${port}/ws`);
  });
});
