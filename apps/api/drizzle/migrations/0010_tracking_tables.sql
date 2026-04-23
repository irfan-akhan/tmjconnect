-- 0010_tracking_tables.sql
--
-- Adds three new patient tracking tables for jaw mobility, medications,
-- and sleep quality. These support the insights/correlation features
-- and give patients + providers richer longitudinal data.

-- ─── jaw_mobility_logs ────────────────────────────────────────────────────
-- Tracks max mouth opening over time. The #1 clinical recovery metric for TMJ.
CREATE TABLE jaw_mobility_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measurement_mm INTEGER NOT NULL CHECK (measurement_mm BETWEEN 1 AND 80),
  method VARCHAR(20) NOT NULL DEFAULT 'fingers',
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jaw_mobility_patient_logged ON jaw_mobility_logs (patient_id, logged_at DESC);

-- ─── medication_logs ──────────────────────────────────────────────────────
-- Per-dose medication tracking. Correlated with pain to show what helps.
CREATE TABLE medication_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_name VARCHAR(120) NOT NULL,
  dosage VARCHAR(60),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_medication_patient_logged ON medication_logs (patient_id, logged_at DESC);

-- ─── sleep_logs ───────────────────────────────────────────────────────────
-- Morning check-in: sleep quality, duration, bruxism awareness, jaw stiffness.
CREATE TABLE sleep_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 5),
  hours_slept NUMERIC(3,1),
  bruxism_aware BOOLEAN NOT NULL DEFAULT false,
  morning_stiffness INTEGER CHECK (morning_stiffness BETWEEN 0 AND 10),
  notes TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sleep_patient_logged ON sleep_logs (patient_id, logged_at DESC);
