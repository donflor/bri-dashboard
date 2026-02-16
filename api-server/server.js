#!/usr/bin/env node
/**
 * Bri Mission Control (BMC) API Server
 * Real-time dashboard for BizRnR AI operations
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.API_PORT || 3034;
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';
const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json';
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';

// Response time tracking
const responseTimes = [];
const MAX_RESPONSE_TIMES = 100;

// In-memory activity log
let activityLog = [];
const MAX_ACTIVITY_ITEMS = 500;

// Track seen messages
let lastSeenMessages = new Map();
let lastSessionsHash = '';

// Add activity item with status
function logActivity(type, description, status = 'completed', duration = null, metadata = {}) {
  const item = {
    id: crypto.randomUUID(),
    type,
    description: description.slice(0, 300),
    timestamp: new Date().toISOString(),
    status, // pending, in_progress, completed, error, info
    duration,
    ...metadata,
  };
  
  // Avoid duplicates within 10 seconds
  const recentDupe = activityLog.find(a => 
    a.description === item.description && 
    new Date(a.timestamp).getTime() > Date.now() - 10000
  );
  if (recentDupe) return recentDupe;
  
  activityLog.unshift(item);
  if (activityLog.length > MAX_ACTIVITY_ITEMS) {
    activityLog = activityLog.slice(0, MAX_ACTIVITY_ITEMS);
  }
  return item;
}

// Track response time
function trackResponseTime(ms) {
  responseTimes.push({ ms, timestamp: Date.now() });
  if (responseTimes.length > MAX_RESPONSE_TIMES) {
    responseTimes.shift();
  }
}

// Calculate average response time (last 10 minutes)
function getAvgResponseTime() {
  const cutoff = Date.now() - 600000; // 10 minutes
  const recent = responseTimes.filter(r => r.timestamp > cutoff);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((sum, r) => sum + r.ms, 0) / recent.length);
}

// Read sessions from file
function readSessions() {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return Object.entries(parsed).map(([key, value]) => ({ key, ...value }));
  } catch (error) {
    console.error('Failed to read sessions:', error.message);
    return [];
  }
}

// Get last message from session transcript
function getLastMessage(transcriptPath) {
  try {
    const filePath = path.join(SESSIONS_DIR, transcriptPath);
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').slice(-50);
    
    // Find last assistant message for response time
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        const msg = entry.message || entry;
        
        if (msg.role === 'assistant' && msg.usage) {
          // Calculate response time from token usage
          const totalTokens = msg.usage.totalTokens || 0;
          // Rough estimate: ~50 tokens/second for Opus
          const estimatedMs = Math.round((totalTokens / 50) * 1000);
          if (estimatedMs > 0) trackResponseTime(estimatedMs);
        }
        
        if (msg.role === 'user' && msg.content) {
          let text = typeof msg.content === 'string' ? msg.content : 
                     msg.content.find?.(c => c.type === 'text')?.text || '';
          
          // Clean Slack format
          const slackMatch = text.match(/Slack message in #\S+ from ([^:]+):\s*(.+?)(?:\s*\[slack|$)/s);
          if (slackMatch) {
            return { sender: slackMatch[1].trim(), text: slackMatch[2].trim().slice(0, 200) };
          }
          
          // Skip system messages
          if (text.startsWith('System:') || text.includes('HEARTBEAT')) continue;
          
          return { text: text.slice(0, 200) };
        }
      } catch {}
    }
  } catch {}
  return null;
}

// Build dashboard state
function buildDashboardState() {
  const sessions = readSessions();
  const now = new Date().toISOString();
  
  // Sort by recency
  const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  // Find main Slack session
  const mainSession = sortedSessions.find(s => 
    s.key?.includes('slack:channel') && !s.key?.includes('thread')
  ) || sortedSessions[0];
  
  // Find cron jobs (sessions with "cron" in key)
  const cronSessions = sortedSessions.filter(s => s.key?.includes('cron:'));
  
  // Find sub-agents (isolated/spawn sessions)
  const subAgentSessions = sortedSessions.filter(s => 
    s.kind === 'isolated' || s.key?.includes('spawn')
  );
  
  // Calculate status
  const lastActivityMs = Math.max(
    mainSession?.updatedAt || 0,
    ...sortedSessions.slice(0, 5).map(s => s.updatedAt || 0)
  );
  const timeSinceActivity = Date.now() - lastActivityMs;
  
  let briStatus = 'idle';
  if (timeSinceActivity < 10000) briStatus = 'active';
  else if (timeSinceActivity < 30000) briStatus = 'thinking';
  
  // Get current task
  let currentTask = null;
  if (mainSession?.transcriptPath) {
    const lastMsg = getLastMessage(mainSession.transcriptPath);
    if (lastMsg) currentTask = lastMsg.text || lastMsg.sender;
  }
  
  // Build cron jobs list
  const cronJobs = cronSessions.map(s => {
    const lastMsg = s.transcriptPath ? getLastMessage(s.transcriptPath) : null;
    const timeSince = Date.now() - (s.updatedAt || 0);
    
    return {
      id: s.key?.split(':').pop() || s.sessionId,
      name: s.label || s.displayName || 'Cron Job',
      lastRun: new Date(s.updatedAt || Date.now()).toISOString(),
      status: timeSince < 60000 ? 'running' : 'completed',
      result: lastMsg?.text?.slice(0, 100) || 'Completed',
      sessionKey: s.key,
    };
  }).slice(0, 20);
  
  // Build sub-agents list
  const subAgents = subAgentSessions.map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    return {
      sessionKey: s.sessionId || s.key,
      label: s.label || s.displayName || 'Sub-agent',
      status: timeSince < 60000 ? 'running' : timeSince < 300000 ? 'completed' : 'idle',
      task: s.task || s.displayName,
      startedAt: new Date(s.createdAt || s.updatedAt || Date.now()).toISOString(),
      completedAt: timeSince > 60000 ? new Date(s.updatedAt || Date.now()).toISOString() : undefined,
      model: s.model,
    };
  }).slice(0, 10);
  
  // Build recent activity from all sessions
  const activities = [];
  
  // Add cron job activities
  cronSessions.forEach(s => {
    const lastMsg = s.transcriptPath ? getLastMessage(s.transcriptPath) : null;
    activities.push({
      id: `cron-${s.sessionId}`,
      type: 'cron',
      description: `${s.label || 'Cron'}: ${lastMsg?.text?.slice(0, 100) || 'Executed'}`,
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: 'completed',
      cronName: s.label,
    });
  });
  
  // Add Slack message activities
  sortedSessions.filter(s => s.key?.includes('slack')).forEach(s => {
    const lastMsg = s.transcriptPath ? getLastMessage(s.transcriptPath) : null;
    if (lastMsg?.sender || lastMsg?.text) {
      activities.push({
        id: `msg-${s.sessionId}`,
        type: 'message',
        description: lastMsg.sender ? `${lastMsg.sender}: ${lastMsg.text}` : lastMsg.text,
        timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
        status: 'completed',
      });
    }
  });
  
  // Merge with activity log
  const allActivities = [...activityLog, ...activities]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50);
  
  // Deduplicate
  const seen = new Set();
  const uniqueActivities = allActivities.filter(a => {
    const key = `${a.type}:${a.description.slice(0, 50)}:${Math.floor(new Date(a.timestamp).getTime() / 60000)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Calculate uptime
  const earliestSession = [...sessions].sort((a, b) => 
    (a.createdAt || a.updatedAt || Date.now()) - (b.createdAt || b.updatedAt || Date.now())
  )[0];
  const uptime = earliestSession 
    ? Math.floor((Date.now() - (earliestSession.createdAt || earliestSession.updatedAt || Date.now())) / 1000)
    : 0;
  
  // Count tasks in last 24h
  const oneDayAgo = Date.now() - 86400000;
  const tasks24h = sessions.filter(s => (s.updatedAt || 0) > oneDayAgo).length;
  
  return {
    bri: {
      status: briStatus,
      currentTask: currentTask?.slice(0, 150),
      model: mainSession?.model || 'claude-opus-4-5',
      sessionKey: mainSession?.sessionId || 'main',
      uptime: Math.min(uptime, 86400 * 30),
      lastActivity: new Date(lastActivityMs).toISOString(),
    },
    cronJobs,
    subAgents,
    recentActivity: uniqueActivities,
    stats: {
      totalTasks24h: tasks24h,
      activeSubAgents: subAgents.filter(s => s.status === 'running').length,
      activeCronJobs: cronJobs.filter(c => c.status === 'running').length,
      avgResponseTime: getAvgResponseTime(),
    },
    lastUpdated: now,
  };
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
  return authHeader.replace('Bearer ', '') === API_TOKEN;
}

// Server
const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Auth required
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

  // Activity log endpoint
  if (url.pathname === '/api/activity' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { type, description, status, duration, ...metadata } = JSON.parse(body);
        const item = logActivity(type, description, status, duration, metadata);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // SSE stream
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const sendState = () => {
      const state = buildDashboardState();
      res.write(`data: ${JSON.stringify(state)}\n\n`);
    };

    sendState();
    const interval = setInterval(sendState, 2000);

    req.on('close', () => clearInterval(interval));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦾 Bri Mission Control API running on port ${PORT}`);
  console.log(`   Status: http://localhost:${PORT}/api/status`);
  console.log(`   Stream: http://localhost:${PORT}/api/stream`);
  logActivity('system', 'BMC API server started', 'info');
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
  process.exit(0);
});
