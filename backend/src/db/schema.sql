-- CP Vault PostgreSQL schema (migrated from localStorage cpvault_v4)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_handles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  codeforces_handle VARCHAR(100),
  leetcode_handle VARCHAR(100),
  atcoder_handle VARCHAR(100),
  cses_handle VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  name VARCHAR(500) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  url TEXT DEFAULT '',
  rating VARCHAR(50) DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  attempts INT NOT NULL DEFAULT 0,
  code TEXT DEFAULT '',
  errors TEXT DEFAULT '',
  concept TEXT DEFAULT '',
  classification VARCHAR(20) CHECK (classification IN ('resolve', 'confident') OR classification IS NULL),
  imported BOOLEAN NOT NULL DEFAULT false,
  solved_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problems_user ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_problems_classification ON problems(user_id, classification);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  title VARCHAR(500) NOT NULL,
  topic VARCHAR(200) NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

CREATE TABLE IF NOT EXISTS revision_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES revision_sessions(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  revision_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (revision_status IN ('pending', 'done')),
  UNIQUE (session_id, problem_id)
);

CREATE TABLE IF NOT EXISTS revision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL DEFAULT 'completed',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_history_user ON revision_history(user_id);

CREATE TABLE IF NOT EXISTS user_contests (
  id VARCHAR(120) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id VARCHAR(120),
  name VARCHAR(500) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  contest_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 120,
  url TEXT DEFAULT '',
  source VARCHAR(20) NOT NULL DEFAULT 'auto',
  reminders JSONB NOT NULL DEFAULT '[]',
  fired_reminders JSONB NOT NULL DEFAULT '[]',
  upsolve_added BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  contests_last_fetched TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contest_id VARCHAR(120),
  name VARCHAR(500) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  contest_date TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upsolve_added BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contest_history_user ON contest_history(user_id);

CREATE TABLE IF NOT EXISTS upsolve_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  name VARCHAR(500) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  contest_name VARCHAR(500) DEFAULT '',
  contest_id VARCHAR(120),
  tags JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'unsolved' CHECK (status IN ('unsolved', 'solved')),
  url TEXT DEFAULT '',
  is_contest_placeholder BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upsolve_user ON upsolve_problems(user_id);

-- Per-contest performance (solved live, upsolved, missed)
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
