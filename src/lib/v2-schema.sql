-- BMC V2 Schema Migration
-- Run against Supabase PROD: ewsahqwtupghisvbekvf

-- ============================================
-- 1. Task Board (Kanban)
-- ============================================
CREATE TABLE IF NOT EXISTS bmc_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'inbox'
    CHECK (status IN ('inbox', 'up_next', 'in_progress', 'in_review', 'done')),
  priority text DEFAULT 'none'
    CHECK (priority IN ('none', 'low', 'medium', 'high')),
  assigned_agent text,
  board_id text DEFAULT 'default',
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmc_tasks_status ON bmc_tasks(status);
CREATE INDEX IF NOT EXISTS idx_bmc_tasks_board ON bmc_tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_bmc_tasks_agent ON bmc_tasks(assigned_agent);

-- ============================================
-- 2. Action Approvals
-- ============================================
CREATE TABLE IF NOT EXISTS bmc_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_agent text NOT NULL,
  action_type text NOT NULL
    CHECK (action_type IN ('architecture_change', 'outbound_sales', 'deployment', 'data_migration', 'configuration', 'other')),
  action_description text NOT NULL,
  risk_level text DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer text,
  reviewed_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmc_approvals_status ON bmc_approvals(status);
CREATE INDEX IF NOT EXISTS idx_bmc_approvals_agent ON bmc_approvals(requesting_agent);

-- ============================================
-- 3. Activity Log (Unified Timeline)
-- ============================================
CREATE TABLE IF NOT EXISTS bmc_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text,
  action_type text NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmc_activity_created ON bmc_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bmc_activity_agent ON bmc_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_bmc_activity_type ON bmc_activity_log(action_type);

-- ============================================
-- 4. Enable Realtime
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE bmc_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE bmc_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE bmc_activity_log;

-- ============================================
-- 5. RLS Policies
-- ============================================
ALTER TABLE bmc_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bmc_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bmc_activity_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (our backend uses service key)
CREATE POLICY "Service role full access" ON bmc_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bmc_approvals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bmc_activity_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 6. Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_bmc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bmc_tasks_updated_at
  BEFORE UPDATE ON bmc_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_bmc_updated_at();
