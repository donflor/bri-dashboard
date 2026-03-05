-- BTP (BizRnR Test Platform) Isolated Schema
-- ALL test data lives in btp_ prefixed tables — NEVER touches production tables

-- ═══════════ BTP Sessions ═══════════
CREATE TABLE IF NOT EXISTS btp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  scenario TEXT NOT NULL CHECK (scenario IN (
    'magic-demo', 'enterprise-escalation', 'winback-sms', 'winback-call',
    'inbound-call', 'sms-reply', 'email-reply'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ BTP CRM Leads (mirrors crm_leads, isolated) ═══════════
CREATE TABLE IF NOT EXISTS btp_crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  lead_score INTEGER DEFAULT 1,
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'btp_test',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ BTP Activities (mirrors crm_activities, isolated) ═══════════
CREATE TABLE IF NOT EXISTS btp_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  lead_id UUID REFERENCES btp_crm_leads(id),
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ BTP Emails ═══════════
CREATE TABLE IF NOT EXISTS btp_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ BTP SMS Messages ═══════════
CREATE TABLE IF NOT EXISTS btp_sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  twilio_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ BTP Call Logs ═══════════
CREATE TABLE IF NOT EXISTS btp_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  recording_url TEXT,
  twilio_sid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ Indexes ═══════════
CREATE INDEX IF NOT EXISTS idx_btp_sessions_account ON btp_sessions(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_sessions_status ON btp_sessions(status);
CREATE INDEX IF NOT EXISTS idx_btp_emails_account ON btp_emails(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_sms_account ON btp_sms_messages(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_calls_account ON btp_call_logs(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_leads_account ON btp_crm_leads(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_activities_account ON btp_activities(test_account_id);

-- ═══════════ RLS Policies ═══════════
-- Enable RLS on all BTP tables
ALTER TABLE btp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_call_logs ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (used by backend)
CREATE POLICY "btp_sessions_service" ON btp_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_crm_leads_service" ON btp_crm_leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_activities_service" ON btp_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_emails_service" ON btp_emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_sms_messages_service" ON btp_sms_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_call_logs_service" ON btp_call_logs FOR ALL USING (true) WITH CHECK (true);

-- ═══════════ Seed Test Accounts ═══════════
INSERT INTO btp_crm_leads (test_account_id, first_name, last_name, email, phone, company, status, source)
VALUES
  ('btp_tester_1', 'Test', 'Alpha', 'tester1@btp.bizrnr.test', '+15550101', 'Alpha Corp', 'new', 'btp_seed'),
  ('btp_tester_2', 'Test', 'Beta', 'tester2@btp.bizrnr.test', '+15550102', 'Beta Inc', 'new', 'btp_seed'),
  ('btp_tester_3', 'Test', 'Gamma', 'tester3@btp.bizrnr.test', '+15550103', 'Gamma LLC', 'new', 'btp_seed'),
  ('btp_tester_4', 'Test', 'Delta', 'tester4@btp.bizrnr.test', '+15550104', 'Delta Corp', 'new', 'btp_seed'),
  ('btp_tester_5', 'Test', 'Epsilon', 'tester5@btp.bizrnr.test', '+15550105', 'Epsilon Ltd', 'new', 'btp_seed')
ON CONFLICT DO NOTHING;
