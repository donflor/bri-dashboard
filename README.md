# 🦾 Bri Status Dashboard

Real-time web dashboard for monitoring Bri (OpenClaw AI assistant) status and activity.

## Features

- **Live Status** — Real-time connection to OpenClaw gateway via WebSocket
- **Sub-agent Tracking** — Monitor spawned sub-agents and their status
- **Activity Log** — Recent tasks and messages with timestamps
- **Stats** — 24h task count, active sub-agents, response times
- **PWA Support** — Add to iOS/Android home screen for app-like experience

## Setup

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure OpenClaw gateway connection:
   ```env
   OPENCLAW_GATEWAY_URL=http://localhost:3033
   OPENCLAW_GATEWAY_TOKEN=your_token
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000

## Production Deployment

### Vercel

```bash
vercel --prod
```

Set environment variables in Vercel dashboard:
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`

### Self-hosted

```bash
npm run build
npm run start
```

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
