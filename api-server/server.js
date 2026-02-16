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

// Response time tracking (in-memory + file-based persistence)
const responseTimes = [];
const completionTimes = [];
const MAX_METRICS = 200;
const METRICS_FILE = path.join(SESSIONS_DIR, '.bmc-metrics.json');

// Load persisted metrics on startup
function loadPersistedMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      if (data.responseTimes) responseTimes.push(...data.responseTimes.slice(0, MAX_METRICS));
      if (data.completionTimes) completionTimes.push(...data.completionTimes.slice(0, MAX_METRICS));
      console.log(`Loaded ${responseTimes.length} response times, ${completionTimes.length} completion times`);
    }
  } catch (e) {
    console.log('No persisted metrics found, starting fresh');
  }
}

// Save metrics periodically
function saveMetrics() {
  try {
    fs.writeFileSync(METRICS_FILE, JSON.stringify({
      responseTimes: responseTimes.slice(0, MAX_METRICS),
      completionTimes: completionTimes.slice(0, MAX_METRICS),
      savedAt: Date.now()
    }));
  } catch (e) {
    console.error('Failed to save metrics:', e.message);
  }
}

loadPersistedMetrics();
setInterval(saveMetrics, 60000); // Save every minute

// Track response time (time to first response)
function trackResponseTime(ms, source = null) {
  if (ms > 0 && ms < 300000) { // Max 5 min
    responseTimes.unshift({ ms, timestamp: Date.now(), source });
    if (responseTimes.length > MAX_METRICS) responseTimes.pop();
  }
}

// Track completion time (total task duration)
function trackCompletionTime(ms, source = null) {
  if (ms > 0 && ms < 600000) { // Max 10 min
    completionTimes.unshift({ ms, timestamp: Date.now(), source });
    if (completionTimes.length > MAX_METRICS) completionTimes.pop();
  }
}

// Calculate average response time (last 24 hours)
function getAvgResponseTime() {
  const cutoff = Date.now() - 86400000; // 24 hours
  const recent = responseTimes.filter(r => r.timestamp > cutoff);
  if (recent.length === 0) return 0;
  return Math.round(recent.reduce((sum, r) => sum + r.ms, 0) / recent.length);
}

// Calculate average completion time (last 24 hours)
function getAvgCompletionTime() {
  const cutoff = Date.now() - 86400000; // 24 hours
  const recent = completionTimes.filter(r => r.timestamp > cutoff);
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

// Extract source info from session key or message
function extractSource(sessionKey, messageText) {
  let source = { type: 'unknown', channel: null, user: null };
  
  // Parse session key for channel info
  // Format: agent:main:slack:channel:CHANNELID:user:USERID
  // Or: agent:main:cron:CRONID
  if (sessionKey) {
    if (sessionKey.includes('slack:channel')) {
      source.type = 'slack';
      const channelMatch = sessionKey.match(/channel:([A-Z0-9]+)/);
      if (channelMatch) source.channel = channelMatch[1];
      const userMatch = sessionKey.match(/user:([A-Z0-9]+)/);
      if (userMatch) source.user = userMatch[1];
    } else if (sessionKey.includes('cron:')) {
      source.type = 'cron';
    } else if (sessionKey.includes('subagent:')) {
      source.type = 'subagent';
    }
  }
  
  // Parse Slack message for user info
  // Format: [Slack Username +3m Mon ...] message content
  if (messageText && typeof messageText === 'string') {
    // Extract username from Slack format: [Slack KP +3m Mon 2026-02-16]
    const slackUserMatch = messageText.match(/\[Slack\s+([A-Za-z0-9_]+)\s+/);
    if (slackUserMatch) {
      source.user = slackUserMatch[1];
      source.type = 'slack';
    }
    
    // Extract channel reference like <#C0AFWQMTU4Q>
    const channelRefMatch = messageText.match(/<#([A-Z0-9]+)>/);
    if (channelRefMatch) {
      source.channel = channelRefMatch[1];
    }
    
    // Check for DM (channel starts with D)
    if (source.channel && source.channel.startsWith('D')) {
      source.channelType = 'dm';
    } else if (source.channel) {
      source.channelType = 'channel';
    }
  }
  
  return source;
}

// Format source for display
function formatSource(source) {
  if (!source) return null;
  
  const parts = [];
  if (source.user) parts.push(source.user);
  if (source.channel) {
    if (source.channelType === 'dm') {
      parts.push('DM');
    } else {
      parts.push(`#${source.channel}`);
    }
  }
  if (source.type === 'cron') return 'Cron';
  if (source.type === 'subagent') return 'Sub-agent';
  
  return parts.length > 0 ? parts.join(' in ') : null;
}

// Parse transcript for recent messages with source tracking
function parseTranscript(transcriptPath, sessionKey) {
  try {
    const filePath = path.join(SESSIONS_DIR, transcriptPath);
    if (!fs.existsSync(filePath)) return [];
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').slice(-100); // Look at more lines
    const activities = [];
    
    let lastUserTimestamp = null;
    let lastUserSource = null;
    let lastUserMessage = null;
    let conversationStart = null;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message || entry;
        const timestamp = msg.timestamp || entry.timestamp;
        
        // User message (incoming)
        if (msg.role === 'user') {
          lastUserTimestamp = new Date(timestamp).getTime();
          
          let text = typeof msg.content === 'string' ? msg.content :
                     msg.content?.find?.(c => c.type === 'text')?.text || '';
          
          lastUserMessage = text;
          lastUserSource = extractSource(sessionKey, text);
          
          // Track conversation start for completion time
          if (!conversationStart) {
            conversationStart = lastUserTimestamp;
          }
          
          // Extract Slack message content
          const slackMatch = text.match(/\[Slack[^\]]*\]\s*([^:]+):\s*(.+?)(?:\s*\[slack|$)/s);
          if (slackMatch) {
            const username = slackMatch[1]?.trim();
            const content = slackMatch[2]?.trim().slice(0, 200);
            if (content && !content.includes('System:') && !content.includes('HEARTBEAT')) {
              const source = { ...lastUserSource, user: username };
              activities.push({
                id: `slack-in-${timestamp}`,
                type: 'incoming',
                description: content,
                timestamp: new Date(timestamp).toISOString(),
                status: 'completed',
                source: source,
                sourceDisplay: formatSource(source),
              });
            }
          }
        }
        
        // Assistant response - calculate response time and completion time
        if (msg.role === 'assistant' && lastUserTimestamp) {
          const responseTime = new Date(timestamp).getTime() - lastUserTimestamp;
          
          // Track response time (time to first response)
          if (responseTime > 0 && responseTime < 300000) {
            trackResponseTime(responseTime, lastUserSource);
          }
          
          let responseText = '';
          if (typeof msg.content === 'string') {
            responseText = msg.content;
          } else if (Array.isArray(msg.content)) {
            const textContent = msg.content.find(c => c.type === 'text');
            responseText = textContent?.text || '';
          }
          
          // Only log meaningful responses
          if (responseText && 
              !responseText.includes('NO_REPLY') && 
              !responseText.includes('HEARTBEAT') &&
              responseText.length > 10) {
            
            // Track completion time if this seems like end of task
            if (conversationStart && (
              responseText.length > 100 || // Substantial response
              !responseText.includes('...') // Not a partial/continued response
            )) {
              const completionTime = new Date(timestamp).getTime() - conversationStart;
              if (completionTime > responseTime) { // Only if different from response time
                trackCompletionTime(completionTime, lastUserSource);
              }
              conversationStart = null; // Reset for next conversation
            }
            
            activities.push({
              id: `slack-out-${timestamp}`,
              type: 'message',
              description: responseText.slice(0, 200),
              timestamp: new Date(timestamp).toISOString(),
              status: 'completed',
              duration: responseTime,
              source: lastUserSource,
              sourceDisplay: formatSource(lastUserSource),
            });
          }
          
          lastUserTimestamp = null;
          lastUserSource = null;
        }
      } catch {}
    }
    
    return activities.slice(-20);
  } catch {
    return [];
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
  
  // Parse main session transcript
  let slackActivities = [];
  if (mainSession?.sessionFile) {
    const transcriptPath = path.basename(mainSession.sessionFile);
    slackActivities = parseTranscript(transcriptPath, mainSession.key);
  }
  
  // Also parse recent DM sessions
  const dmSessions = sortedSessions.filter(s => 
    s.key?.includes('slack:') && s.key?.includes(':D') // DMs start with D
  ).slice(0, 5);
  
  for (const dm of dmSessions) {
    if (dm.sessionFile) {
      const transcriptPath = path.basename(dm.sessionFile);
      const dmActivities = parseTranscript(transcriptPath, dm.key);
      slackActivities.push(...dmActivities);
    }
  }
  
  // Find CRON JOBS - only base cron jobs, not individual runs
  const cronSessions = sortedSessions.filter(s => 
    s.key?.includes('cron:') && !s.key?.includes(':run:')
  );
  
  // Find recent cron RUNS for activity log
  const cronRuns = sortedSessions.filter(s => 
    s.key?.includes('cron:') && s.key?.includes(':run:')
  ).slice(0, 20);
  
  // Find SUB-AGENTS - sessions with 'subagent:' in key
  const subAgentSessions = sortedSessions.filter(s => 
    s.key?.includes('subagent:')
  );
  
  // Calculate status
  const lastActivityMs = mainSession?.updatedAt || 0;
  const timeSinceActivity = Date.now() - lastActivityMs;
  
  let briStatus = 'idle';
  if (timeSinceActivity < 10000) briStatus = 'active';
  else if (timeSinceActivity < 60000) briStatus = 'thinking';
  
  // Build cron jobs list (deduplicated)
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
    
    // Find most recent run for this cron job
    const latestRun = cronRuns.find(r => r.key?.includes(cronId));
    const lastRunTime = latestRun?.updatedAt || s.updatedAt;
    
    return {
      id: cronId,
      name: s.label || s.displayName || 'Cron Job',
      lastRun: new Date(lastRunTime).toISOString(),
      status: timeSince < 120000 ? 'running' : 'completed',
      result: 'Completed',
      sessionKey: s.key,
    };
  });
  
  // Build sub-agents list with source info
  const subAgents = subAgentSessions.slice(0, 15).map(s => {
    const timeSince = Date.now() - (s.updatedAt || 0);
    return {
      sessionKey: s.sessionId || s.key,
      label: s.label || s.displayName || 'Sub-agent',
      status: timeSince < 120000 ? 'running' : 'completed',
      task: s.task || s.label,
      startedAt: new Date(s.createdAt || s.updatedAt || Date.now()).toISOString(),
      completedAt: timeSince > 120000 ? new Date(s.updatedAt).toISOString() : undefined,
      model: s.model,
      source: extractSource(s.key, s.task),
      sourceDisplay: formatSource(extractSource(s.key, s.task)),
    };
  });
  
  // Build activity from Slack + cron runs
  const activities = [...slackActivities];
  
  // Add cron run activities
  cronRuns.slice(0, 10).forEach(s => {
    const cronName = s.label || 'Cron job';
    const cronSource = { type: 'cron', channel: null, user: null };
    activities.push({
      id: `cron-${s.sessionId}`,
      type: 'cron',
      description: cronName,
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: 'completed',
      cronName,
      source: cronSource,
      sourceDisplay: 'Cron',
    });
  });
  
  // Add sub-agent activities
  subAgentSessions.slice(0, 5).forEach(s => {
    const source = extractSource(s.key, s.task);
    activities.push({
      id: `subagent-${s.sessionId}`,
      type: 'subagent',
      description: s.label || 'Sub-agent task',
      timestamp: new Date(s.updatedAt || Date.now()).toISOString(),
      status: Date.now() - (s.updatedAt || 0) < 120000 ? 'running' : 'completed',
      source,
      sourceDisplay: formatSource(source) || 'Sub-agent',
    });
  });
  
  // Sort by timestamp and dedupe
  const seenIds = new Set();
  const sortedActivities = activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter(a => {
      if (seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    })
    .slice(0, 30);
  
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
  
  // Calculate metrics from tracked data
  const avgResponseTime = getAvgResponseTime();
  const avgCompletionTime = getAvgCompletionTime();
  
  return {
    bri: {
      status: briStatus,
      currentTask: slackActivities.find(m => m.type === 'incoming')?.description?.slice(0, 150),
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
    const interval = setInterval(sendState, 2000);

    req.on('close', () => clearInterval(interval));
    return;
  }
  
  if (url.pathname === '/api/metrics') {
    const avgResponseTime = getAvgResponseTime();
    const avgCompletionTime = getAvgCompletionTime();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      avgResponseTime,
      avgCompletionTime,
      responseSamples: responseTimes.length,
      completionSamples: completionTimes.length,
      recentResponseTimes: responseTimes.slice(0, 10),
      recentCompletionTimes: completionTimes.slice(0, 10),
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🦾 Bri Mission Control API running on port ${PORT}`);
  console.log(`   Metrics: ${responseTimes.length} response times, ${completionTimes.length} completion times loaded`);
});

process.on('SIGTERM', () => {
  saveMetrics();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  saveMetrics();
  server.close();
  process.exit(0);
});
