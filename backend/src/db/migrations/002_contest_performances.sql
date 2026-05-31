-- Run if upgrading an existing database: npm run db:init won't re-run schema; apply this manually or via migrate script

CREATE TABLE IF NOT EXISTS contest_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  contest_id VARCHAR(120),
  contest_name VARCHAR(500) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  contest_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 120,
  solved_live INT NOT NULL DEFAULT 0,
  problems JSONB NOT NULL DEFAULT '[]',
  notes TEXT DEFAULT '',
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_perf_user ON contest_performances(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_perf_date ON contest_performances(user_id, contest_date DESC);
