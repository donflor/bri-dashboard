#!/usr/bin/env node
/**
 * Bri Dashboard API Server
 * Exposes OpenClaw session data via HTTP API
 * Run alongside the OpenClaw gateway on the same server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.API_PORT || 3034;
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';
const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json';

// In-memory activity log (persists while server runs)
let activityLog = [];
const MAX_ACTIVITY_ITEMS = 200;

// Add activity item
function logActivity(type, description, status = 'success', duration = null) {
  const item = {
    id: crypto.randomUUID(),
    type,
    description: description.slice(0, 200),
    timestamp: new Date().toISOString(),
    status,
    duration,
  };
  activityLog.unshift(item);
  if (activityLog.length > MAX_ACTIVITY_ITEMS) {
    activityLog = activityLog.slice(0, MAX_ACTIVITY_ITEMS);
  }
  return item;
}

// Read sessions from file
function readSessions() {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read sessions:', error.message);
    return { sessions: [] };
  }
}

// Build dashboard state from session data
function buildDashboardState() {
  const data = readSessions();
  const sessions = data.sessions || [];
  const now = new Date().toISOString();
  
  // Find the main/most recent session
  const sortedSessions = [...sessions].sort((a, b) => 
    (b.updatedAt || 0) - (a.updatedAt || 0)
  );
  
  const mainSession = sortedSessions.find(s => 
    s.kind === 'main' || s.agentId === 'main' || s.key?.includes('slack')
  ) || sortedSessions[0];
  
  // Find sub-agents (isolated sessions with recent activity)
  const subAgentSessions = sortedSessions.filter(s => 
    s.kind === 'isolated' || s.kind === 'subagent' || 
    (s.key?.includes('spawn') && s.updatedAt > Date.now() - 3600000)
  ).slice(0, 10);

  // Calculate time since last activity
  const lastActivityMs = mainSession?.updatedAt || Date.now();
  const timeSinceActivity = Date.now() - lastActivityMs;
  
  // Determine status based on recent activity
  let briStatus = 'idle';
  if (timeSinceActivity < 10000) briStatus = 'active';
  else if (timeSinceActivity < 60000) briStatus = 'thinking';
  
  // Calculate uptime from earliest session
  const earliestSession = [...sessions].sort((a, b) => 
    (a.createdAt || a.updatedAt || Date.now()) - (b.createdAt || b.updatedAt || Date.now())
  )[0];
  const uptime = earliestSession 
    ? Math.floor((Date.now() - (earliestSession.createdAt || earliestSession.updatedAt || Date.now())) / 1000)
    : 0;

  // Build sub-agents list
  const subAgents = subAgentSessions.map(s => {
    const sessionAge = Date.now() - (s.updatedAt || Date.now());
    return {
      sessionKey: s.sessionId || s.key,
      label: s.label || s.key?.split(':').pop()?.slice(0, 30) || 'sub-agent',
      status: sessionAge < 60000 ? 'running' : 'completed',
      task: s.lastMessage?.slice(0, 150) || s.task?.slice(0, 150) || 'Processing...',
      startedAt: new Date(s.createdAt || s.updatedAt || Date.now()).toISOString(),
      completedAt: sessionAge > 60000 ? new Date(s.updatedAt || Date.now()).toISOString() : undefined,
      model: s.model,
    };
  });

  // Auto-generate activity from sessions
  const sessionActivities = sortedSessions
    .filter(s => s.updatedAt > Date.now() - 24 * 60 * 60 * 1000) // Last 24h
    .slice(0, 30)
    .map(s => ({
      id: s.sessionId || crypto.randomUUID(),
      type: s.kind === 'isolated' ? 'subagent' : s.key?.includes('slack') ? 'message' : 'task',
      description: s.lastMessage?.slice(0, 150) || `Session: ${s.key?.split(':').slice(-2).join(':')}`,
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: 'success',
      duration: s.totalDuration || null,
    }));

  // Merge with manual activity log
  const allActivity = [...activityLog, ...sessionActivities]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50);

  // Filter to last 24 hours
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentActivity = allActivity.filter(a => new Date(a.timestamp).getTime() > oneDayAgo);

  return {
    bri: {
      status: briStatus,
      currentTask: mainSession?.lastMessage?.slice(0, 150),
      model: mainSession?.model || 'claude-opus-4-5',
      sessionKey: mainSession?.sessionId || 'main',
      uptime: Math.min(uptime, 86400 * 30), // Cap at 30 days
      lastActivity: new Date(lastActivityMs).toISOString(),
    },
    subAgents,
    recentActivity,
    stats: {
      totalTasks24h: recentActivity.length,
      activeSubAgents: subAgents.filter(s => s.status === 'running').length,
      avgResponseTime: 2100,
    },
    lastUpdated: now,
  };
}

// Watch for session file changes
let lastMtime = 0;
function checkSessionChanges() {
  try {
    const stats = fs.statSync(SESSIONS_FILE);
    if (stats.mtimeMs > lastMtime) {
      lastMtime = stats.mtimeMs;
      return true;
    }
  } catch {}
  return false;
}

// CORS headers
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Auth check
function checkAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  return token === API_TOKEN;
}

// Request handler
const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check (no auth required)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Auth required for other endpoints
  if (!checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Status endpoint
  if (url.pathname === '/api/status') {
    const state = buildDashboardState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

  // Log activity endpoint (POST)
  if (url.pathname === '/api/activity' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { type, description, status, duration } = JSON.parse(body);
        const item = logActivity(type, description, status, duration);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // SSE stream endpoint
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial state
    const initialState = buildDashboardState();
    res.write(`data: ${JSON.stringify(initialState)}\n\n`);

    // Poll and send updates every 2 seconds
    let lastState = JSON.stringify(initialState);
    const interval = setInterval(() => {
      // Check if sessions file changed
      const changed = checkSessionChanges();
      const state = buildDashboardState();
      const stateJson = JSON.stringify(state);
      
      // Send update if state changed or file was modified
      if (stateJson !== lastState || changed) {
        lastState = stateJson;
        res.write(`data: ${stateJson}\n\n`);
      }
    }, 2000);

    // Cleanup on close
    req.on('close', () => {
      clearInterval(interval);
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦾 Bri Dashboard API Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Status: http://localhost:${PORT}/api/status`);
  console.log(`   Stream: http://localhost:${PORT}/api/stream`);
  console.log(`   Sessions file: ${SESSIONS_FILE}`);
  
  // Initialize mtime
  try {
    const stats = fs.statSync(SESSIONS_FILE);
    lastMtime = stats.mtimeMs;
    console.log(`   Found ${readSessions().sessions?.length || 0} sessions`);
  } catch (e) {
    console.log('   Warning: Could not read sessions file');
  }
  
  // Log startup activity
  logActivity('system', 'Dashboard API server started', 'info');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});
