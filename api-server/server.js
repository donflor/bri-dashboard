#!/usr/bin/env node
/**
 * Bri Mission Control (BMC) API Server v2
 * Real-time dashboard for BizRnR AI operations
 * 
 * Tracks: Slack DMs, channels, cron jobs, sub-agents, response times
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.API_PORT || 3034;
const API_TOKEN = process.env.DASHBOARD_API_TOKEN || 'bri-dashboard-token-2026';
const SESSIONS_FILE = '/root/.openclaw/agents/main/sessions/sessions.json';
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';
const METRICS_FILE = path.join(SESSIONS_DIR, '.bmc-metrics.json');

// Metrics tracking with persistence
let metrics = {
  responseTimes: [],
  completionTimes: [],
  lastParsedTimestamps: {}, // Track last parsed timestamp per session
};
const MAX_METRICS = 500;

// Load persisted metrics
function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      metrics = { ...metrics, ...data };
      console.log(`Loaded metrics: ${metrics.responseTimes.length} response times`);
    }
  } catch (e) {
    console.log('Starting with fresh metrics');
  }
}

// Save metrics
function saveMetrics() {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify({
      responseTimes: metrics.responseTimes.slice(0, MAX_METRICS),
      completionTimes: metrics.completionTimes.slice(0, MAX_METRICS),
      lastParsedTimestamps: metrics.lastParsedTimestamps,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.error('Failed to save metrics:', e.message);
  }
}

loadMetrics();
setInterval(saveMetrics, 30000); // Save every 30s

// Track a response time (minimum 1s - real AI responses take at least this long)
function trackResponseTime(ms, source) {
  if (ms >= 1000 && ms < 300000) { // Between 1s and 5 min
    metrics.responseTimes.unshift({ ms, timestamp: Date.now(), source });
    if (metrics.responseTimes.length > MAX_METRICS) metrics.responseTimes.pop();
  }
}

// Track completion time
function trackCompletionTime(ms, source) {
  if (ms >= 2000 && ms < 600000) { // Between 2s and 10 min
    metrics.completionTimes.unshift({ ms, timestamp: Date.now(), source });
    if (metrics.completionTimes.length > MAX_METRICS) metrics.completionTimes.pop();
  }
}

// Calculate averages (last 24h)
function getAvgResponseTime() {
  const cutoff = Date.now() - 86400000;
  const recent = metrics.responseTimes.filter(r => r.timestamp > cutoff);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((sum, r) => sum + r.ms, 0) / recent.length);
}

function getAvgCompletionTime() {
  const cutoff = Date.now() - 86400000;
  const recent = metrics.completionTimes.filter(r => r.timestamp > cutoff);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((sum, r) => sum + r.ms, 0) / recent.length);
}

// Read sessions.json
function readSessions() {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

// Parse a transcript file for activities and metrics
function parseTranscript(sessionFile, sessionInfo) {
  const activities = [];
  
  try {
    if (!fs.existsSync(sessionFile)) return activities;
    
    const content = fs.readFileSync(sessionFile, 'utf8');
    const lines = content.trim().split('\n');
    
    // Get session identifiers
    const sessionId = sessionInfo.sessionId;
    const userLabel = sessionInfo.origin?.label || 'Unknown';
    const chatType = sessionInfo.chatType || 'unknown';
    const isDirectMessage = chatType === 'direct';
    
    // Only parse new entries since last time
    const lastTimestamp = metrics.lastParsedTimestamps[sessionId] || 0;
    let newestTimestamp = lastTimestamp;
    
    let lastUserTime = null;
    let lastUserContent = null;
    
    // Process last 100 lines (most recent)
    const recentLines = lines.slice(-100);
    
    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message || entry;
        const timestamp = new Date(msg.timestamp || entry.timestamp).getTime();
        
        if (!timestamp || isNaN(timestamp)) continue;
        newestTimestamp = Math.max(newestTimestamp, timestamp);
        
        // Skip already processed entries for metrics
        const isNew = timestamp > lastTimestamp;
        
        // User message
        if (msg.role === 'user') {
          lastUserTime = timestamp;
          
          let text = typeof msg.content === 'string' ? msg.content :
                     msg.content?.find?.(c => c.type === 'text')?.text || '';
          lastUserContent = text;
          
          // Extract from System line: "System: [...] Slack DM from Username: actual message"
          // Or from Slack line: "[Slack Username ...] actual message [slack message id: ...]"
          let username = userLabel;
          let messageContent = '';
          
          // Try System line format first (more reliable)
          const systemMatch = text.match(/System:\s*\[[^\]]+\]\s*Slack\s+(?:DM\s+from\s+)?(\w+):\s*(.+?)(?:\n|\[Slack|$)/s);
          if (systemMatch) {
            username = systemMatch[1]?.trim();
            messageContent = systemMatch[2]?.trim();
          } else {
            // Try Slack line format: [Slack Username ...] content [slack message id...]
            const slackMatch = text.match(/\[Slack\s+(\w+)[^\]]*\]\s*(.+?)(?:\s*\[slack\s+message\s+id:|\s*\[message_id:|\n|$)/si);
            if (slackMatch) {
              username = slackMatch[1]?.trim();
              messageContent = slackMatch[2]?.trim();
            }
          }
          
          // Clean up any remaining metadata
          messageContent = messageContent
            .replace(/\s*\[slack\s+message\s+id:[^\]]*\]/gi, '')
            .replace(/\s*\[message_id:[^\]]*\]/gi, '')
            .replace(/\s*channel:\s*\w+\]/gi, '')
            .trim();
          
          // Skip system messages, heartbeats, and short messages
          if (messageContent && 
              !messageContent.includes('HEARTBEAT') &&
              !messageContent.includes('Pre-compaction') &&
              !messageContent.startsWith('System:') &&
              messageContent.length > 5) {
            
            activities.push({
              id: `in-${sessionId}-${timestamp}`,
              type: 'incoming',
              description: messageContent.slice(0, 250),
              timestamp: new Date(timestamp).toISOString(),
              status: 'completed',
              source: {
                type: 'slack',
                user: username,
                chatType: isDirectMessage ? 'dm' : 'channel',
              },
              sourceDisplay: isDirectMessage ? `${username} (DM)` : `${username} (#channel)`,
            });
          }
        }
        
        // Assistant response - track metrics and create activity
        if (msg.role === 'assistant' && lastUserTime) {
          const responseTime = timestamp - lastUserTime;
          
          let responseText = '';
          if (typeof msg.content === 'string') {
            responseText = msg.content;
          } else if (Array.isArray(msg.content)) {
            const textContent = msg.content.find(c => c.type === 'text');
            responseText = textContent?.text || '';
          }
          
          // Track metrics for new entries only
          if (isNew && responseTime > 100 && responseTime < 300000) {
            const source = { 
              type: 'slack', 
              user: userLabel,
              chatType: isDirectMessage ? 'dm' : 'channel'
            };
            trackResponseTime(responseTime, source);
            
            // Track completion time for substantial responses
            if (responseText.length > 100) {
              trackCompletionTime(responseTime, source);
            }
          }
          
          // Create activity for meaningful responses
          if (responseText && 
              !responseText.includes('NO_REPLY') && 
              !responseText.includes('HEARTBEAT_OK') &&
              responseText.length > 20) {
            
            activities.push({
              id: `out-${sessionId}-${timestamp}`,
              type: 'message',
              description: responseText.slice(0, 250),
              timestamp: new Date(timestamp).toISOString(),
              status: 'completed',
              duration: responseTime,
              source: {
                type: 'slack',
                user: userLabel,
                chatType: isDirectMessage ? 'dm' : 'channel',
              },
              sourceDisplay: isDirectMessage ? `to ${userLabel} (DM)` : `in #channel`,
            });
          }
          
          lastUserTime = null;
        }
      } catch (e) {
        // Skip malformed lines
      }
    }
    
    // Update last parsed timestamp
    if (newestTimestamp > lastTimestamp) {
      metrics.lastParsedTimestamps[sessionId] = newestTimestamp;
    }
    
  } catch (e) {
    console.error(`Error parsing transcript ${sessionFile}:`, e.message);
  }
  
  return activities;
}

// Build full dashboard state
function buildDashboardState() {
  const sessionsData = readSessions();
  const sessions = Object.entries(sessionsData).map(([key, value]) => ({ key, ...value }));
  const now = new Date().toISOString();
  
  // Sort by most recent activity
  const sortedSessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  // === FIND ALL SLACK SESSIONS (channels + DMs) ===
  const slackSessions = sortedSessions.filter(s => 
    s.key?.includes('slack:channel') || s.key?.includes('slack:direct')
  );
  
  // Main session for status
  const mainSession = slackSessions[0] || sortedSessions.find(s => s.key?.includes(':main')) || sortedSessions[0];
  
  // === PARSE ACTIVITIES FROM ALL SLACK SESSIONS ===
  const allActivities = [];
  
  for (const session of slackSessions.slice(0, 10)) { // Parse top 10 most recent
    if (session.sessionFile) {
      const activities = parseTranscript(session.sessionFile, session);
      allActivities.push(...activities);
    }
  }
  
  // === FIND CRON JOBS ===
  const cronSessions = sortedSessions.filter(s => 
    s.key?.includes('cron:') && !s.key?.includes(':run:')
  );
  
  const cronRuns = sortedSessions.filter(s => 
    s.key?.includes('cron:') && s.key?.includes(':run:')
  ).slice(0, 30);
  
  // Build cron jobs list
  const seenCronIds = new Set();
  const cronJobs = cronSessions.slice(0, 20).filter(s => {
    const parts = s.key?.split(':') || [];
    const cronId = parts[3] || s.sessionId;
    if (seenCronIds.has(cronId)) return false;
    seenCronIds.add(cronId);
    return true;
  }).map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    const parts = s.key?.split(':') || [];
    const cronId = parts[3] || s.sessionId;
    const latestRun = cronRuns.find(r => r.key?.includes(cronId));
    
    return {
      id: cronId,
      name: s.label || s.displayName || 'Cron Job',
      lastRun: new Date(latestRun?.updatedAt || s.updatedAt || Date.now()).toISOString(),
      status: timeSince < 120000 ? 'running' : 'completed',
      result: 'Completed',
    };
  });
  
  // Add cron activities
  cronRuns.slice(0, 15).forEach(s => {
    allActivities.push({
      id: `cron-${s.sessionId}`,
      type: 'cron',
      description: s.label || 'Cron job',
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: 'completed',
      source: { type: 'cron' },
      sourceDisplay: 'Cron',
    });
  });
  
  // === FIND SUB-AGENTS ===
  const subAgentSessions = sortedSessions.filter(s => s.key?.includes('subagent:'));
  
  const subAgents = subAgentSessions.slice(0, 15).map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    return {
      sessionKey: s.sessionId || s.key,
      label: s.label || s.displayName || 'Sub-agent',
      status: timeSince < 120000 ? 'running' : 'completed',
      task: s.task || s.label,
      startedAt: new Date(s.createdAt || s.updatedAt || Date.now()).toISOString(),
      model: s.model,
      source: { type: 'subagent' },
      sourceDisplay: 'Sub-agent',
    };
  });
  
  // Add sub-agent activities
  subAgentSessions.slice(0, 10).forEach(s => {
    allActivities.push({
      id: `subagent-${s.sessionId}`,
      type: 'subagent',
      description: s.label || 'Sub-agent task',
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: Date.now() - (s.updatedAt || 0) < 120000 ? 'running' : 'completed',
      source: { type: 'subagent' },
      sourceDisplay: 'Sub-agent',
    });
  });
  
  // === SORT AND DEDUPE ACTIVITIES ===
  const seenIds = new Set();
  const sortedActivities = allActivities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter(a => {
      if (seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    })
    .slice(0, 50);
  
  // === CALCULATE STATUS ===
  const lastActivityMs = mainSession?.updatedAt || 0;
  const timeSinceActivity = Date.now() - lastActivityMs;
  
  let briStatus = 'idle';
  if (timeSinceActivity < 10000) briStatus = 'active';
  else if (timeSinceActivity < 60000) briStatus = 'thinking';
  
  // === CALCULATE STATS ===
  const oneDayAgo = Date.now() - 86400000;
  const tasks24h = sessions.filter(s => (s.updatedAt || 0) > oneDayAgo).length;
  
  const avgResponseTime = getAvgResponseTime();
  const avgCompletionTime = getAvgCompletionTime();
  
  // Uptime
  const earliestSession = [...sessions].sort((a, b) => 
    (a.createdAt || a.updatedAt || Date.now()) - (b.createdAt || b.updatedAt || Date.now())
  )[0];
  const uptime = earliestSession 
    ? Math.floor((Date.now() - (earliestSession.createdAt || earliestSession.updatedAt)) / 1000)
    : 0;
  
  return {
    bri: {
      status: briStatus,
      currentTask: sortedActivities.find(a => a.type === 'incoming')?.description?.slice(0, 150),
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
      avgResponseTime,
      avgCompletionTime,
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
  const auth = req.headers.authorization;
  if (!auth) return false;
  return auth.replace('Bearer ', '') === API_TOKEN;
}

// HTTP Server
const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // Health check (no auth)
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // All other endpoints require auth
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

  // SSE stream endpoint
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
    const interval = setInterval(sendState, 3000);
    req.on('close', () => clearInterval(interval));
    return;
  }
  
  // Metrics debug endpoint
  if (url.pathname === '/api/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      avgResponseTime: getAvgResponseTime(),
      avgCompletionTime: getAvgCompletionTime(),
      responseSamples: metrics.responseTimes.length,
      completionSamples: metrics.completionTimes.length,
      recentResponseTimes: metrics.responseTimes.slice(0, 20),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦾 Bri Mission Control API v2 running on port ${PORT}`);
  console.log(`   Metrics loaded: ${metrics.responseTimes.length} response times`);
});

// Graceful shutdown
process.on('SIGTERM', () => { saveMetrics(); server.close(); process.exit(0); });
process.on('SIGINT', () => { saveMetrics(); server.close(); process.exit(0); });
