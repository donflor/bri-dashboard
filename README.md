# 🦾 Bri Status Dashboard

Real-time web dashboard for monitoring Bri (OpenClaw AI assistant) status and activity.

## Features

- **Live Status** — Real-time connection to OpenClaw gateway via WebSocket
- **Sub-agent Tracking** — Monitor spawned sub-agents and their status
- **Activity Log** — Recent tasks and messages with timestamps
- **Stats** — 24h task count, active sub-agents, response times
- **PWA Support** — Add to iOS/Android home screen for app-like experience

## Quick Start

### Demo Mode (No Setup Required)

The dashboard works out of the box with simulated data:

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll see realistic demo data.

### Live Mode (Connected to OpenClaw)

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure OpenClaw gateway connection:
   ```env
   OPENCLAW_GATEWAY_URL=http://localhost:3033
   OPENCLAW_GATEWAY_TOKEN=your_token
   ```

3. Run:
   ```bash
   npm install
   npm run dev
   ```

## Production Deployment

### Option 1: Vercel (Demo Mode)

Deploy instantly with demo data:

```bash
vercel --prod
```

The Vercel deployment will show realistic simulated data by default since it can't reach a local gateway.

### Option 2: Self-Hosted (Live Mode)

For live data, host the dashboard alongside your OpenClaw gateway:

```bash
npm run build
npm run start
```

This runs a custom server with WebSocket support for real-time updates.

### Option 3: Vercel + Public Gateway

If you expose your OpenClaw gateway API publicly (with auth):

1. Set up a reverse proxy for your gateway
2. Configure Vercel environment variables:
   - `OPENCLAW_GATEWAY_URL=https://your-gateway.example.com`
   - `OPENCLAW_GATEWAY_TOKEN=your_secure_token`

## iOS Home Screen

1. Open dashboard in Safari
2. Tap Share → "Add to Home Screen"
3. Name it "Bri"
4. Dashboard opens in standalone mode like a native app

## Architecture

```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│  Bri Dashboard  │◄──────────────►│  Custom Server  │
│    (React)      │                │  (Next.js +     │
└─────────────────┘                │   Socket.IO)    │
                                   └────────┬────────┘
                                            │ HTTP
                                            ▼
                                   ┌─────────────────┐
                                   │ OpenClaw Gateway│
                                   │   (sessions)    │
                                   └─────────────────┘
```

- Dashboard connects via WebSocket to custom server
- Server polls OpenClaw gateway every 2s
- Only emits updates when state changes (efficient)
- Auto-reconnects on connection loss

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Socket.IO (WebSocket)
- Tailwind CSS 4
- TypeScript
