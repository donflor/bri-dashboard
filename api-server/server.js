#!/usr/bin/env node
/**
 * Bri Mission Control (BMC) API Server
 * Real-time dashboard for BizRnR AI operations
 * Tracks Slack requests and response times
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.API_PORT || 3034;
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';
const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json';
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';

// Response time tracking - tracks request to response for Slack messages
const responseTimes = [];
const MAX_RESPONSE_TIMES = 50;
const pendingRequests = new Map(); // Track in-progress Slack requests

// In-memory activity log
let activityLog = [];
const MAX_ACTIVITY_ITEMS = 200;

// Track seen messages for deduplication
let seenMessages = new Set();

// Add activity item
function logActivity(type, description, status = 'completed', duration = null, metadata = {}) {
  const item = {
    id: crypto.randomUUID(),
    type,
    description: description.slice(0, 300),
    timestamp: new Date().toISOString(),
    status,
    duration,
    ...metadata,
  };
  
  // Check for duplicates (same description within 30 seconds)
  const isDupe = activityLog.some(a => 
    a.description === item.description && 
    new Date(a.timestamp).getTime() > Date.now() - 30000
  );
  if (isDupe) return null;
  
  activityLog.unshift(item);
  if (activityLog.length > MAX_ACTIVITY_ITEMS) {
    activityLog = activityLog.slice(0, MAX_ACTIVITY_ITEMS);
  }
  return item;
}

// Track response time
function trackResponseTime(ms, label) {
  responseTimes.unshift({ ms, label, timestamp: Date.now() });
  if (responseTimes.length > MAX_RESPONSE_TIMES) {
    responseTimes.pop();
  }
}

// Calculate average response time (last 5 minutes)
function getAvgResponseTime() {
  const cutoff = Date.now() - 300000; // 5 minutes
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
    return [];
  }
}

// Parse transcript file for messages and timing
function parseTranscript(transcriptPath) {
  try {
    const filePath = path.join(SESSIONS_DIR, transcriptPath);
    if (!fs.existsSync(filePath)) return { lastMessage: null, messages: [] };
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').slice(-100);
    const messages = [];
    
    let lastUserTime = null;
    let lastAssistantTime = null;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message || entry;
        const timestamp = entry.timestamp || msg.timestamp;
        
        if (msg.role === 'user') {
          lastUserTime = timestamp;
          
          // Extract Slack message
          let text = typeof msg.content === 'string' ? msg.content :
                     msg.content?.find?.(c => c.type === 'text')?.text || '';
          
          const slackMatch = text.match(/\[Slack[^\]]+\]\s*(\d+:\d+[^\]]*)\]\s*([^:]+):\s*(.+?)(?:\s*\[slack|$)/s) ||
                            text.match(/Slack message in #(\S+) from ([^:]+):\s*(.+?)(?:\s*\[slack|$)/s);
          
          if (slackMatch) {
            const msgId = `${transcriptPath}:${timestamp}`;
            if (!seenMessages.has(msgId)) {
              seenMessages.add(msgId);
              const sender = slackMatch[2]?.replace(/<@[A-Z0-9]+>/g, '').trim() || 'User';
              const content = slackMatch[3]?.trim().slice(0, 150) || slackMatch[1];
              
              // Track as pending if no response yet
              pendingRequests.set(msgId, { 
                timestamp, 
                sender, 
                content,
                startTime: Date.now()
              });
              
              messages.push({
                type: 'incoming',
                sender,
                content,
                timestamp: new Date(timestamp).toISOString(),
                status: 'pending',
              });
            }
          }
        }
        
        if (msg.role === 'assistant' && lastUserTime) {
          lastAssistantTime = timestamp;
          
          // Calculate response time
          if (lastUserTime && lastAssistantTime) {
            const responseMs = lastAssistantTime - lastUserTime;
            if (responseMs > 0 && responseMs < 300000) { // Max 5 min
              trackResponseTime(responseMs, 'slack-response');
              
              // Clear any pending requests
              for (const [key, req] of pendingRequests.entries()) {
                if (req.timestamp === lastUserTime) {
                  pendingRequests.delete(key);
                }
              }
            }
          }
          
          // Get response text
          let responseText = '';
          if (typeof msg.content === 'string') {
            responseText = msg.content;
          } else if (Array.isArray(msg.content)) {
            const textContent = msg.content.find(c => c.type === 'text');
            responseText = textContent?.text || '';
          }
          
          if (responseText && !responseText.includes('NO_REPLY') && !responseText.includes('HEARTBEAT')) {
            messages.push({
              type: 'response',
              content: responseText.slice(0, 200),
              timestamp: new Date(timestamp).toISOString(),
              status: 'completed',
              duration: lastAssistantTime - lastUserTime,
            });
          }
          
          lastUserTime = null;
        }
      } catch {}
    }
    
    // Keep seenMessages from growing unbounded
    if (seenMessages.size > 1000) {
      seenMessages = new Set([...seenMessages].slice(-500));
    }
    
    return { messages: messages.slice(-20) };
  } catch {
    return { messages: [] };
  }
}

// Build dashboard state
function buildDashboardState() {
  const sessions = readSessions();
  const now = new Date().toISOString();
  
  const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  // Find main Slack session
  const mainSession = sortedSessions.find(s => 
    s.key?.includes('slack:channel') && !s.key?.includes('thread')
  ) || sortedSessions[0];
  
  // Parse main session transcript for real-time activity
  let slackMessages = [];
  if (mainSession?.transcriptPath) {
    const parsed = parseTranscript(mainSession.transcriptPath);
    slackMessages = parsed.messages || [];
  }
  
  // Find cron jobs
  const cronSessions = sortedSessions.filter(s => s.key?.includes('cron:'));
  
  // Find sub-agents
  const subAgentSessions = sortedSessions.filter(s => 
    s.kind === 'isolated' || s.key?.includes('spawn')
  );
  
  // Calculate status based on pending requests and recent activity
  const hasPending = pendingRequests.size > 0 || 
    slackMessages.some(m => m.status === 'pending');
  
  const lastActivityMs = Math.max(
    mainSession?.updatedAt || 0,
    ...sortedSessions.slice(0, 5).map(s => s.updatedAt || 0)
  );
  const timeSinceActivity = Date.now() - lastActivityMs;
  
  let briStatus = 'idle';
  if (hasPending || timeSinceActivity < 10000) briStatus = 'active';
  else if (timeSinceActivity < 30000) briStatus = 'thinking';
  
  // Build cron jobs list
  const cronJobs = cronSessions.slice(0, 15).map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    return {
      id: s.key?.split(':').pop() || s.sessionId,
      name: s.label || s.displayName || 'Cron Job',
      lastRun: new Date(s.updatedAt || Date.now()).toISOString(),
      status: timeSince < 60000 ? 'running' : 'completed',
      result: s.displayName?.includes(':') ? s.displayName.split(':').pop().trim() : 'Completed',
      sessionKey: s.key,
    };
  });
  
  // Build sub-agents list
  const subAgents = subAgentSessions.slice(0, 10).map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    return {
      sessionKey: s.sessionId || s.key,
      label: s.label || s.displayName || 'Sub-agent',
      status: timeSince < 60000 ? 'running' : 'completed',
      task: s.task || s.displayName,
      startedAt: new Date(s.createdAt || s.updatedAt || Date.now()).toISOString(),
      completedAt: timeSince > 60000 ? new Date(s.updatedAt).toISOString() : undefined,
      model: s.model,
    };
  });
  
  // Build activity from Slack messages + cron + pending
  const activities = [];
  
  // Add pending requests first (in-progress)
  for (const [key, req] of pendingRequests.entries()) {
    const elapsed = Date.now() - req.startTime;
    activities.push({
      id: `pending-${key}`,
      type: 'incoming',
      description: `${req.sender}: ${req.content}`,
      timestamp: new Date(req.timestamp).toISOString(),
      status: 'in_progress',
      duration: elapsed,
    });
  }
  
  // Add Slack messages
  slackMessages.forEach((msg, i) => {
    activities.push({
      id: `slack-${i}-${msg.timestamp}`,
      type: msg.type === 'incoming' ? 'incoming' : 'message',
      description: msg.sender ? `${msg.sender}: ${msg.content}` : msg.content,
      timestamp: msg.timestamp,
      status: msg.status,
      duration: msg.duration,
    });
  });
  
  // Add cron job activities
  cronSessions.slice(0, 10).forEach(s => {
    activities.push({
      id: `cron-${s.sessionId}`,
      type: 'cron',
      description: s.label || s.displayName || 'Cron job executed',
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: 'completed',
      cronName: s.label,
    });
  });
  
  // Sort by timestamp and dedupe
  const sortedActivities = activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 50);
  
  // Uptime calculation
  const earliestSession = [...sessions].sort((a, b) => 
    (a.createdAt || a.updatedAt || Date.now()) - (b.createdAt || b.updatedAt || Date.now())
  )[0];
  const uptime = earliestSession 
    ? Math.floor((Date.now() - (earliestSession.createdAt || earliestSession.updatedAt || Date.now())) / 1000)
    : 0;
  
  // Tasks count
  const oneDayAgo = Date.now() - 86400000;
  const tasks24h = sessions.filter(s => (s.updatedAt || 0) > oneDayAgo).length;
  
  return {
    bri: {
      status: briStatus,
      currentTask: slackMessages.find(m => m.status === 'pending')?.content?.slice(0, 150),
      model: mainSession?.model || 'claude-opus-4-5',
      sessionKey: mainSession?.sessionId || 'main',
      uptime: Math.min(uptime, 86400 * 30),
      lastActivity: new Date(lastActivityMs).toISOString(),
    },
    cronJobs,
    subAgents,
    recentActivity: sortedActivities,
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
  
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (!checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  if (url.pathname === '/api/status') {
    const state = buildDashboardState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
    return;
  }

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
    const interval = setInterval(sendState, 1500); // Faster updates

    req.on('close', () => clearInterval(interval));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦾 Bri Mission Control API running on port ${PORT}`);
  console.log(`   Tracking Slack response times in real-time`);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});
