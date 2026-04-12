-- Migration: 0005_job_runs.sql
-- Adds the job_runs table for tracking scheduled job execution history.
-- Used by the admin "Job runner health" panel (TODO #3).

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('running', 'success', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS job_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       VARCHAR(50)    NOT NULL,
  status         job_status     NOT NULL,
  started_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  duration_ms    INTEGER,
  rows_affected  INTEGER,
  error_message  TEXT,
  metadata       JSONB          NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_started
  ON job_runs(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_status
  ON job_runs(status);

-- Prune old job runs after 30 days (the admin UI only cares about recent history).
-- The cleanupJob can call: DELETE FROM job_runs WHERE created_at < NOW() - INTERVAL '30 days';
