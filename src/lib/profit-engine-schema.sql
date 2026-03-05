CREATE TABLE IF NOT EXISTS profit_engine_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  stripe_mrr numeric(10,2) DEFAULT 0,
  stripe_subscribers integer DEFAULT 0,
  twilio_cost numeric(10,2) DEFAULT 0,
  elevenlabs_cost numeric(10,2) DEFAULT 0,
  llm_cost numeric(10,2) DEFAULT 0,
  infra_cost numeric(10,2) DEFAULT 0,
  total_api_burn numeric(10,2) DEFAULT 0,
  net_margin numeric(10,2) DEFAULT 0,
  margin_percent numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profit_engine_date ON profit_engine_metrics(date DESC);
