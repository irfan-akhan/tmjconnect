-- Migration: 0007_clinical_notes_report_requests_on_behalf.sql
-- Adds three concepts the provider portal needs:
--   1. clinical_notes     — provider-private notes ABOUT a patient (never patient-visible)
--   2. report_requests    — provider asks patient to file a report
--   3. reports.authored_* — provider files a report on-behalf-of a patient

-- ─── 1. clinical_notes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinical_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NULL when provider is hard-deleted. History is preserved.
  provider_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT NOT NULL,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_patient_created
  ON clinical_notes(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_provider_created
  ON clinical_notes(provider_id, created_at DESC);

-- ─── 2. report_requests ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE report_request_status AS ENUM ('pending', 'fulfilled', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS report_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt              TEXT NOT NULL,
  status              report_request_status NOT NULL DEFAULT 'pending',
  fulfilled_report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  fulfilled_at        TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_requests_patient_status
  ON report_requests(patient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_requests_provider_created
  ON report_requests(provider_id, created_at DESC);

-- ─── 3. reports.authored_* (on-behalf-of) ─────────────────────────────────────────
-- authored_by_user_id: who actually authored the report row. NULL = legacy (patient).
-- authored_by_role:    'patient' (default) or 'provider' (on-behalf-of).
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS authored_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS authored_by_role    VARCHAR(20) NOT NULL DEFAULT 'patient';

-- Backfill existing rows — every pre-migration report was patient-authored.
UPDATE reports
  SET authored_by_user_id = patient_id
  WHERE authored_by_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_authored_by_role
  ON reports(authored_by_role);
