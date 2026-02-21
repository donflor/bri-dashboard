#!/usr/bin/env node
/**
 * Gateway Data Proxy
 * 
 * Lightweight Express server that exposes OpenClaw gateway data
 * for the BMC dashboard on Vercel to consume.
 * 
 * Secured with a Bearer token.
 * Runs on port 3847 (configurable).
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PROXY_PORT || 3847;
const AUTH_TOKEN = process.env.PROXY_TOKEN || 'bmc-gateway-' + require('crypto').randomBytes(16).toString('hex');

// Cache
let cache = {};
const CACHE_TTL = 15_000; // 15s

function cached(key, fn) {
  const now = Date.now();
  if (cache[key] && now - cache[key].time < CACHE_TTL) return cache[key].data;
  const data = fn();
  cache[key] = { data, time: now };
  return data;
}

function runCmd(cmd) {
  try {
    return JSON.parse(execSync(cmd, { timeout: 10000, encoding: 'utf8' }));
  } catch (e) {
    console.error(`Command failed: ${cmd}`, e.message);
    return null;
  }
}

function getCronJobs() {
  return cached('crons', () => {
    const result = runCmd('openclaw cron list --json 2>/dev/null');
    if (!result || !result.jobs) return [];
    return result.jobs.map(j => ({
      id: j.id || j.jobId,
      name: j.name || j.id || j.jobId,
      schedule: j.schedule?.expr || (j.schedule?.everyMs ? `every ${Math.round(j.schedule.everyMs / 60000)}m` : '—'),
      enabled: j.enabled !== false,
      lastRun: j.state?.lastRunAtMs ? new Date(j.state.lastRunAtMs).toISOString() : null,
      nextRun: j.state?.nextRunAtMs ? new Date(j.state.nextRunAtMs).toISOString() : null,
      lastStatus: j.state?.lastStatus || null,
      sessionTarget: j.sessionTarget || null,
      payload: j.payload?.kind || null,
    }));
  });
}

function getSubAgents() {
  return cached('sessions', () => {
    const result = runCmd('openclaw sessions list --json 2>/dev/null');
    if (!result || !Array.isArray(result)) return [];
    return result
      .filter(s => s.key && s.key.includes('subagent'))
      .slice(0, 30)
      .map(s => ({
        sessionKey: s.key,
        label: s.label || s.key.split(':').pop(),
        status: (s.ageMs && s.ageMs < 120000) ? 'running' : 'completed',
        model: s.model || null,
        ageMs: s.ageMs || null,
        updatedAt: s.updatedAt || null,
      }));
  });
}

function getAllSessions() {
  return cached('all-sessions', () => {
    const result = runCmd('openclaw sessions list --json 2>/dev/null');
    if (!result || !Array.isArray(result)) return [];
    return result.map(s => ({
      key: s.key,
      label: s.label || null,
      kind: s.key.includes('subagent') ? 'subagent' : s.key.includes('cron') ? 'cron' : s.key === 'main' ? 'main' : 'chat',
      model: s.model || null,
      ageMs: s.ageMs || null,
      updatedAt: s.updatedAt || null,
    }));
  });
}

function getGatewayStatus() {
  return cached('status', () => {
    const result = runCmd('openclaw status --json 2>/dev/null');
    return result || { status: 'unknown' };
  });
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Auth
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AUTH_TOKEN}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  let body;

  switch (url.pathname) {
    case '/api/cron/list':
      body = { jobs: getCronJobs() };
      break;
    case '/api/sessions/list':
      body = { sessions: getAllSessions() };
      break;
    case '/api/sessions/subagents':
      body = { subAgents: getSubAgents() };
      break;
    case '/api/status':
      body = getGatewayStatus();
      break;
    case '/api/health':
      body = { ok: true, time: new Date().toISOString() };
      break;
    case '/api/all':
      // Combined endpoint — one call for everything
      body = {
        cronJobs: getCronJobs(),
        subAgents: getSubAgents(),
        sessions: getAllSessions(),
        gateway: getGatewayStatus(),
        time: new Date().toISOString(),
      };
      break;
    default:
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway proxy running on port ${PORT}`);
  console.log(`Auth token: ${AUTH_TOKEN}`);
  console.log(`Test: curl -H "Authorization: Bearer ${AUTH_TOKEN}" http://localhost:${PORT}/api/health`);
});
