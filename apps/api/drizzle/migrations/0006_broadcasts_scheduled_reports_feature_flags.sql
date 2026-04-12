-- Migration: 0006_broadcasts_scheduled_reports_feature_flags.sql
-- Adds tables for TODO #12 (Broadcasts), #14 (Scheduled reports), #15 (Feature flags)
-- and tsvector indexes for TODO #11 (Global search).

-- ═══════════════════════════════════════════════════════════════════════════════
-- #12: Broadcasts
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  audience         VARCHAR(20)  NOT NULL,  -- 'all' | 'patients' | 'providers' | 'admins'
  type             VARCHAR(20)  NOT NULL,  -- 'system' | 'announcement'
  title            VARCHAR(255) NOT NULL,
  body             TEXT         NOT NULL,
  channels         TEXT[]       NOT NULL,  -- {'in_app', 'email'}
  recipient_count  INTEGER      NOT NULL DEFAULT 0,
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- #14: Scheduled exports / saved reports
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  entity           VARCHAR(50)  NOT NULL,  -- 'audit_logs' | 'login_events' | 'users' | 'reports'
  filters          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  cadence          VARCHAR(20)  NOT NULL,  -- 'daily' | 'weekly' | 'monthly'
  recipient_emails TEXT[]       NOT NULL,
  next_run_at      TIMESTAMPTZ  NOT NULL,
  last_run_at      TIMESTAMPTZ,
  enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_due
  ON scheduled_reports(next_run_at) WHERE enabled = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- #15: Feature flags
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feature_flags (
  key              VARCHAR(100) PRIMARY KEY,
  enabled          BOOLEAN      NOT NULL DEFAULT FALSE,
  description      TEXT,
  rollout_percent  INTEGER      NOT NULL DEFAULT 0 CHECK (rollout_percent BETWEEN 0 AND 100),
  target_roles     TEXT[],
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- #11: Full-text search (tsvector) for global admin search
-- ═══════════════════════════════════════════════════════════════════════════════

-- Composite text search on user email + profile name
CREATE INDEX IF NOT EXISTS idx_users_search_fts
  ON users USING gin (to_tsvector('english', email));

CREATE INDEX IF NOT EXISTS idx_profiles_search_fts
  ON profiles USING gin (to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')));

-- Audit log action search
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON audit_logs(action, created_at DESC);
