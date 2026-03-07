-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260307_bmc_btp_upgrade.sql
-- BMC + BTP Upgrade — Database & Activity Log
-- ═══════════════════════════════════════════════════════════════

-- ═══════════ TASK 1: Create Missing BTP Tables ═══════════

-- BTP Projects
CREATE TABLE IF NOT EXISTS btp_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BTP Sprints (belongs to project)
CREATE TABLE IF NOT EXISTS btp_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES btp_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BTP Tasks (belongs to project, optionally to sprint)
CREATE TABLE IF NOT EXISTS btp_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES btp_projects(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES btp_sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee TEXT,
  due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BTP Time Entries (belongs to task)
CREATE TABLE IF NOT EXISTS btp_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES btp_tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for BTP tables
CREATE INDEX IF NOT EXISTS idx_btp_projects_account ON btp_projects(test_account_id);
CREATE INDEX IF NOT EXISTS idx_btp_sprints_project ON btp_sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_btp_tasks_project ON btp_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_btp_tasks_sprint ON btp_tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_btp_tasks_status ON btp_tasks(status);
CREATE INDEX IF NOT EXISTS idx_btp_time_entries_task ON btp_time_entries(task_id);

-- RLS for BTP tables
ALTER TABLE btp_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE btp_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "btp_projects_service" ON btp_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_sprints_service" ON btp_sprints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_tasks_service" ON btp_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "btp_time_entries_service" ON btp_time_entries FOR ALL USING (true) WITH CHECK (true);


-- ═══════════ TASK 2: Expand bmc_activity_log Schema ═══════════

ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'system';
ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS source_channel TEXT;
ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS source_user TEXT;
ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS request_id TEXT;
ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;
ALTER TABLE bmc_activity_log ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_bmc_activity_source_type_created ON bmc_activity_log(source_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bmc_activity_request_id ON bmc_activity_log(request_id);


-- ═══════════ TASK 3: RPC for logging activity ═══════════

CREATE OR REPLACE FUNCTION log_bmc_activity(
  p_agent_id TEXT,
  p_action_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_source_type TEXT DEFAULT 'system',
  p_source_channel TEXT DEFAULT NULL,
  p_source_user TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_severity TEXT DEFAULT 'info'
) RETURNS uuid AS $$
  INSERT INTO bmc_activity_log (agent_id, action_type, description, metadata, source_type, source_channel, source_user, request_id, response_time_ms, severity)
  VALUES (p_agent_id, p_action_type, p_description, p_metadata, p_source_type, p_source_channel, p_source_user, p_request_id, p_response_time_ms, p_severity)
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER;


-- ═══════════ TASK 4: Seed BTP Test Data ═══════════

-- 2 test sessions
INSERT INTO btp_sessions (test_account_id, scenario, status, started_at, ended_at, metadata) VALUES
  ('btp_tester_1', 'magic-demo', 'success', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', '{"result": "demo_completed", "lead_captured": true}'),
  ('btp_tester_1', 'winback-sms', 'running', NOW() - INTERVAL '10 minutes', NULL, '{"step": "sms_sent", "attempt": 1}');

-- 3 SMS messages
INSERT INTO btp_sms_messages (test_account_id, direction, from_number, to_number, body, twilio_sid) VALUES
  ('btp_tester_1', 'outbound', '+18005551234', '+15550101', 'Hey! Your BizRnR demo is ready. Check it out: https://demo.bizrnr.com/abc123', 'SM_test_001'),
  ('btp_tester_1', 'inbound', '+15550101', '+18005551234', 'Looks great! How much does it cost?', 'SM_test_002'),
  ('btp_tester_1', 'outbound', '+18005551234', '+15550101', 'We have plans starting at affordable rates. Want to hop on a quick call?', 'SM_test_003');

-- 2 emails
INSERT INTO btp_emails (test_account_id, direction, from_email, to_email, subject, body) VALUES
  ('btp_tester_1', 'inbound', 'tester1@btp.bizrnr.test', 'bri@bizrnr.com', 'Interested in BizRnR', 'Hi, I saw your demo and I am interested in learning more about pricing and features.'),
  ('btp_tester_1', 'outbound', 'bri@bizrnr.com', 'tester1@btp.bizrnr.test', 'Re: Interested in BizRnR', 'Thanks for reaching out! BizRnR automates your lead generation. Let me set up a personalized demo for you.');

-- 1 call log
INSERT INTO btp_call_logs (test_account_id, direction, from_number, to_number, duration_seconds, twilio_sid) VALUES
  ('btp_tester_1', 'outbound', '+18005551234', '+15550101', 187, 'CA_test_001');

-- Seed a BTP project with sprint and tasks
INSERT INTO btp_projects (id, test_account_id, name, description, status) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'btp_tester_1', 'BTP Sandbox Launch', 'Test project for BTP sandbox UI validation', 'active');

INSERT INTO btp_sprints (id, project_id, name, goal, status, start_date, end_date) VALUES
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sprint 1 - Foundation', 'Set up core BTP tables and seed data', 'completed', '2026-03-01', '2026-03-07');

INSERT INTO btp_tasks (project_id, sprint_id, title, description, status, priority, assignee) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Create BTP schema', 'Define all BTP tables with proper constraints', 'done', 'critical', 'daba'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Seed test data', 'Insert realistic test data for sandbox UI', 'in_progress', 'high', 'daba'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', NULL, 'Build sandbox UI components', 'React components for BTP dashboard', 'todo', 'high', 'product_engineer');

INSERT INTO btp_time_entries (task_id, agent_id, duration_minutes, description) VALUES
  ((SELECT id FROM btp_tasks WHERE title = 'Create BTP schema' LIMIT 1), 'daba', 45, 'Schema design and migration creation');
