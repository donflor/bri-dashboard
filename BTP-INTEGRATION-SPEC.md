# BMC + BTP Unified Dashboard — Integration Specification

## Overview
Merge the BizRnr Test Platform (BTP) directly into the BizRnr Mission Control (BMC v2) as a unified "God Mode" Next.js app. Single codebase, single deployment, dual-mode operation.

## Architecture Decisions
- **Base:** Existing bri-dashboard (Next.js 16, React 19, Tailwind 4, Supabase, NextAuth, Socket.io)
- **New Dependencies:** `twilio` (for WebRTC softphone), no other new deps needed
- **Database:** Supabase PROD (`ewsahqwtupghisvbekvf`) with isolated `btp_` prefixed tables
- **Auth:** NextAuth with Supabase — add `role` field to session (Admin/Viewer)

## 1. Global Environment Toggle & RBAC

### Environment Toggle
- Add `EnvironmentToggle` component in the top navigation header
- Two modes: `Production` (default) and `BTP Sandbox`
- Store selection in React context (`EnvironmentContext`)
- Toggle visually distinct: Production = green indicator, BTP Sandbox = amber/orange indicator

### RBAC Enforcement
- Add `role` column to the auth flow (check Supabase `auth.users` metadata or a `user_roles` table)
- Roles: `admin` (full access), `viewer` (sandbox only)
- If user is NOT admin:
  - Production tab is completely hidden (not just disabled — removed from DOM)
  - Stripe data, live agent kill switches, real user data are inaccessible
  - API routes for production data return 403
- Middleware check in `src/middleware.ts` for route-level protection

## 2. The "Glasshouse" Testing Interface

### New Route: `/sandbox` or tab within main dashboard
Create a new tab "BTP Sandbox" in the main navigation alongside existing tabs.

### Split-Screen Layout
```
┌──────────────────────────────────────────────────────────────┐
│  BTP Sandbox — Glasshouse Testing Interface                   │
├─────────────────────────┬────────────────────────────────────┤
│  Human UX (Left Pane)   │  AI Telemetry (Right Pane)         │
│                         │                                     │
│  ┌─────────────────┐   │  ┌────────────────────────────────┐│
│  │ Twilio Softphone │   │  │ Agent Log Stream               ││
│  │ (WebRTC Dialer)  │   │  │ (filtered by test session)     ││
│  └─────────────────┘   │  │                                 ││
│                         │  │ [2026-03-05 07:10:22] router... ││
│  ┌─────────────────┐   │  │ [2026-03-05 07:10:23] closer...││
│  │ SMS Chat Panel   │   │  │ [2026-03-05 07:10:24] voice... ││
│  │ (send/receive)   │   │  │                                 ││
│  └─────────────────┘   │  └────────────────────────────────┘│
│                         │                                     │
│  ┌─────────────────┐   │  ┌────────────────────────────────┐│
│  │ Email Feed       │   │  │ Session Metadata               ││
│  │ (Postmark inbox) │   │  │ - Test Account: Tester 1       ││
│  └─────────────────┘   │  │ - Session ID: btp_xxx          ││
│                         │  │ - Duration: 00:02:34           ││
│                         │  └────────────────────────────────┘│
├─────────────────────────┴────────────────────────────────────┤
│  Test Playbook — One-Click Scenario Triggers                  │
│  [Magic Demo → T1] [Enterprise Escalation] [T+24h Winback]  │
│  [Inbound Call Sim] [SMS Reply Test] [Email Reply Test]      │
└──────────────────────────────────────────────────────────────┘
```

### Left Pane Components

#### TwilioSoftphone (`src/components/btp/TwilioSoftphone.tsx`)
- WebRTC-based dialing pad using Twilio Client JS SDK
- Connect to Twilio via capability token from API route
- Dialer UI: number pad, call/hangup buttons, call status indicator
- Audio controls (mute, speaker)
- Uses test Twilio numbers only (isolated from prod)

#### SMSChatPanel (`src/components/btp/SMSChatPanel.tsx`)
- Chat-style interface for sending/receiving SMS
- Uses Twilio REST API via backend route
- Shows conversation thread with test numbers
- Real-time updates via WebSocket

#### EmailFeedPanel (`src/components/btp/EmailFeedPanel.tsx`)
- Shows inbound/outbound email feed for 5 test accounts
- Fetches from Postmark inbound webhook data stored in `btp_emails` table
- Compose & send test emails
- Filter by test account

### Right Pane Components

#### AgentLogStream (EXISTING — enhance with filtering)
- Already exists at `src/components/AgentLogStream.tsx`
- Add: filter by `btp_session_id` to show only logs for the active test
- Add: visual tagging of agent names (color-coded badges)
- Add: search/filter within logs

#### SessionMetadata (`src/components/btp/SessionMetadata.tsx`)
- Shows active test session info
- Test account name, session ID, duration timer
- Link to associated CRM record in `btp_crm_leads`

## 3. One-Click Scenario Triggers (Test Playbook)

### TestPlaybook (`src/components/btp/TestPlaybook.tsx`)
- Grid of trigger buttons, each fires an API call
- Visual state: idle → running → success/fail

### Scenarios to Wire:
| Button | Backend Action | API Route |
|--------|---------------|-----------|
| Magic Demo → Tester 1 | Trigger ElevenLabs demo flow for test account | POST /api/btp/trigger/magic-demo |
| Enterprise Escalation | Simulate enterprise-tier lead escalation | POST /api/btp/trigger/enterprise-escalation |
| T+24h Win-back SMS | Fire the Closer's win-back SMS sequence | POST /api/btp/trigger/winback-sms |
| T+12h Win-back Call | Fire the Closer's voice call | POST /api/btp/trigger/winback-call |
| Inbound Call Sim | Simulate an inbound call to test number | POST /api/btp/trigger/inbound-call |
| SMS Reply Test | Simulate inbound SMS reply | POST /api/btp/trigger/sms-reply |
| Email Reply Test | Simulate inbound email reply | POST /api/btp/trigger/email-reply |

### API Routes (`src/app/api/btp/trigger/[scenario]/route.ts`)
- Validate admin role
- Create `btp_session` record
- Dispatch to appropriate service (Twilio, ElevenLabs, Postmark)
- Return session ID for real-time tracking
- ALL writes go to `btp_` tables only

## 4. Data Isolation

### Supabase Schema — BTP Tables
Create these tables in Supabase (all prefixed `btp_`):
- `btp_sessions` — test session tracking
- `btp_crm_leads` — mirrors `crm_leads` structure but isolated
- `btp_activities` — mirrors `crm_activities` but isolated
- `btp_emails` — inbound/outbound test emails
- `btp_sms_messages` — test SMS messages
- `btp_call_logs` — test call recordings/metadata

### Isolation Rules
- BTP trigger routes MUST use `btp_` tables exclusively
- Production `crm_leads`, `crm_activities`, `tenants` are NEVER written to by BTP
- Supabase RLS policies enforce this at the database level
- API middleware validates `X-BTP-Mode: sandbox` header on all BTP routes

### Test Accounts (5 pre-provisioned)
| ID | Name | Phone | Email |
|----|------|-------|-------|
| btp_tester_1 | Test User Alpha | +1-555-0101 | tester1@btp.bizrnr.test |
| btp_tester_2 | Test User Beta | +1-555-0102 | tester2@btp.bizrnr.test |
| btp_tester_3 | Test User Gamma | +1-555-0103 | tester3@btp.bizrnr.test |
| btp_tester_4 | Test User Delta | +1-555-0104 | tester4@btp.bizrnr.test |
| btp_tester_5 | Test User Epsilon | +1-555-0105 | tester5@btp.bizrnr.test |

## 5. File Structure (New Files)

```
src/
├── components/
│   └── btp/
│       ├── EnvironmentToggle.tsx      # Production/Sandbox toggle
│       ├── GlasshouseLayout.tsx       # Split-screen container
│       ├── TwilioSoftphone.tsx        # WebRTC dialer
│       ├── SMSChatPanel.tsx           # SMS send/receive
│       ├── EmailFeedPanel.tsx         # Email feed viewer
│       ├── TestPlaybook.tsx           # One-click triggers
│       ├── SessionMetadata.tsx        # Active session info
│       └── TestAccountSelector.tsx    # Pick test account
├── contexts/
│   └── EnvironmentContext.tsx         # Prod/Sandbox state
├── app/
│   └── api/
│       └── btp/
│           ├── trigger/
│           │   └── [scenario]/route.ts
│           ├── sms/route.ts           # SMS send endpoint
│           ├── emails/route.ts        # Email feed endpoint
│           ├── sessions/route.ts      # Session management
│           └── twilio-token/route.ts  # WebRTC capability token
├── lib/
│   ├── btp-supabase.ts               # BTP-specific Supabase queries
│   └── rbac.ts                       # Role checking utilities
└── types/
    └── btp.ts                         # BTP type definitions
```

## 6. Security Requirements
- All BTP API routes require `admin` role
- BTP routes must verify `X-BTP-Mode: sandbox` header
- No production data accessible from BTP endpoints
- Supabase RLS enforces table-level isolation
- WebRTC tokens scoped to test Twilio numbers only
- All BTP actions logged to `btp_sessions` for audit trail

## 7. Environment Variables Needed
```
# Already have:
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# New for BTP:
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_TWIML_APP_SID       # For WebRTC
BTP_TWILIO_TEST_NUMBER      # Dedicated test number
POSTMARK_SERVER_TOKEN       # For email testing
```
