-- TMJConnect Initial Database Schema
-- Generated for: PostgreSQL 16
-- Extensions required: uuid-ossp, pgcrypto
-- Run this migration once against a fresh database, then use drizzle-kit migrate for subsequent changes.

-- ─── Extensions ───────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('patient', 'provider', 'admin');
CREATE TYPE linking_code_status AS ENUM ('pending', 'connected', 'expired');
CREATE TYPE assignment_status AS ENUM ('active', 'paused', 'completed');
CREATE TYPE urgency_level AS ENUM ('routine', 'concerning', 'urgent');
CREATE TYPE report_status AS ENUM ('submitted', 'viewed', 'reviewed', 'responded');
CREATE TYPE reminder_type AS ENUM ('exercise', 'symptom');
CREATE TYPE digest_frequency AS ENUM ('instant', 'daily', 'weekly', 'off');

-- ─── users ────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    phone VARCHAR(20),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verify_code VARCHAR(6),
    email_verify_expires TIMESTAMPTZ,
    mfa_secret TEXT,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    fcm_token TEXT,
    tos_accepted_at TIMESTAMPTZ,
    tos_version VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ─── profiles ─────────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(20),
    avatar_url TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Chicago',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── provider_details ─────────────────────────────────────────────────────────────
CREATE TABLE provider_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(100) NOT NULL,
    license_type VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    clinic_name VARCHAR(200) NOT NULL,
    credentials TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── refresh_tokens ───────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    token_family UUID NOT NULL,
    device_info TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── sessions ─────────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info TEXT,
    ip_address INET,
    last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── mfa_backup_codes ─────────────────────────────────────────────────────────────
CREATE TABLE mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ
);

-- ─── password_resets ──────────────────────────────────────────────────────────────
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── linking_codes ────────────────────────────────────────────────────────────────
CREATE TABLE linking_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) NOT NULL UNIQUE,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status linking_code_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── patient_provider_links ───────────────────────────────────────────────────────
CREATE TABLE patient_provider_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unlinked_at TIMESTAMPTZ
);

-- ─── exercises ────────────────────────────────────────────────────────────────────
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_seconds INTEGER,
    category VARCHAR(100),
    instructions TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── exercise_assignments ─────────────────────────────────────────────────────────
CREATE TABLE exercise_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL DEFAULT 'daily',
    sets INTEGER NOT NULL DEFAULT 1,
    status assignment_status NOT NULL DEFAULT 'active',
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── exercise_completions ─────────────────────────────────────────────────────────
CREATE TABLE exercise_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES exercise_assignments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── symptom_logs ─────────────────────────────────────────────────────────────────
CREATE TABLE symptom_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pain_level INTEGER NOT NULL CHECK (pain_level BETWEEN 0 AND 10),
    pain_types TEXT[] NOT NULL DEFAULT '{}',
    body_areas JSONB NOT NULL DEFAULT '[]',
    duration_minutes INTEGER,
    triggers TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── reports ──────────────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    urgency urgency_level NOT NULL,
    pain_level INTEGER CHECK (pain_level IS NULL OR pain_level BETWEEN 0 AND 10),
    description TEXT NOT NULL,
    photo_url TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    summary_data JSONB NOT NULL DEFAULT '{}',
    patient_notes TEXT,
    status report_status NOT NULL DEFAULT 'submitted',
    flagged BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ
);

-- ─── report_responses ─────────────────────────────────────────────────────────────
CREATE TABLE report_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    internal_notes TEXT,
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── notifications ────────────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── notification_preferences ─────────────────────────────────────────────────────
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    exercise_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    symptom_checkin BOOLEAN NOT NULL DEFAULT TRUE,
    provider_messages BOOLEAN NOT NULL DEFAULT TRUE,
    report_updates BOOLEAN NOT NULL DEFAULT TRUE,
    tips_updates BOOLEAN NOT NULL DEFAULT FALSE,
    email_digest digest_frequency NOT NULL DEFAULT 'instant',
    next_digest_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── reminders ────────────────────────────────────────────────────────────────────
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type reminder_type NOT NULL,
    time TIME NOT NULL,
    days JSONB NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    next_fire_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────────
-- HIPAA: Append-only. user_id SET NULL on user delete. Never deleted. 6-year retention.
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── login_events ─────────────────────────────────────────────────────────────────
CREATE TABLE login_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    device_info TEXT,
    failure_reason VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── idempotency_keys ─────────────────────────────────────────────────────────────
CREATE TABLE idempotency_keys (
    key VARCHAR(64) PRIMARY KEY,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- =================================================================================
-- INDEXES (Section 6.8)
-- =================================================================================

-- users
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active) WHERE deleted_at IS NULL;

-- refresh_tokens
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_family ON refresh_tokens(token_family);

-- sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- password_resets
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_user_id ON password_resets(user_id);

-- linking_codes
CREATE INDEX idx_linking_codes_provider_id ON linking_codes(provider_id);

-- patient_provider_links
CREATE UNIQUE INDEX idx_ppl_active_link ON patient_provider_links(patient_id, provider_id)
    WHERE unlinked_at IS NULL;
CREATE INDEX idx_ppl_patient_id ON patient_provider_links(patient_id)
    WHERE unlinked_at IS NULL;
CREATE INDEX idx_ppl_provider_id ON patient_provider_links(provider_id)
    WHERE unlinked_at IS NULL;

-- exercise_assignments
CREATE INDEX idx_ea_patient_id ON exercise_assignments(patient_id)
    WHERE status = 'active';
CREATE INDEX idx_ea_provider_id ON exercise_assignments(provider_id);

-- exercise_completions
CREATE UNIQUE INDEX idx_ec_daily_unique ON exercise_completions(assignment_id, patient_id, ((completed_at AT TIME ZONE 'UTC')::date));
CREATE INDEX idx_ec_patient_logged ON exercise_completions(patient_id, completed_at);

-- symptom_logs
CREATE INDEX idx_sl_patient_logged ON symptom_logs(patient_id, logged_at DESC);

-- reports
CREATE INDEX idx_reports_provider_status ON reports(provider_id, status);
CREATE INDEX idx_reports_urgency ON reports(urgency, submitted_at DESC);
CREATE INDEX idx_reports_patient ON reports(patient_id);

-- notifications
CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC)
    WHERE read = FALSE;

-- reminders
CREATE INDEX idx_reminders_next_fire ON reminders(next_fire_at) WHERE enabled = TRUE;
CREATE INDEX idx_reminders_user ON reminders(user_id) WHERE enabled = TRUE;

-- notification_preferences
CREATE INDEX idx_notif_prefs_next_digest ON notification_preferences(next_digest_at)
    WHERE next_digest_at IS NOT NULL;

-- audit_logs
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action_time ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- login_events
CREATE INDEX idx_login_user_time ON login_events(user_id, created_at DESC);
CREATE INDEX idx_login_email_time ON login_events(email, created_at DESC);

-- idempotency_keys
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- =================================================================================
-- TRIGGERS (Section 6.9)
-- =================================================================================

-- Reusable trigger function for auto-updating updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that tracks changes via updated_at.
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_provider_details_updated_at
  BEFORE UPDATE ON provider_details FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_symptom_logs_updated_at
  BEFORE UPDATE ON symptom_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_reminders_updated_at
  BEFORE UPDATE ON reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =================================================================================
-- SYMPTOM LOG EDIT WINDOW TRIGGER (Section 6.7)
-- Prevents editing a symptom log after 24 hours from creation.
-- Anchored to created_at (server-set, immutable) — NOT logged_at (client-provided).
-- This prevents patients from backdating logged_at to exploit the edit window.
-- =================================================================================

CREATE OR REPLACE FUNCTION enforce_symptom_edit_window()
RETURNS TRIGGER AS $$
BEGIN
  IF (NOW() - OLD.created_at) > INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Symptom log edit window has expired (24 hours from creation).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_symptom_edit_window
  BEFORE UPDATE ON symptom_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_symptom_edit_window();

-- =================================================================================
-- DATABASE PERMISSIONS (Section 6.10) — HIPAA
-- Run these commands as a superuser after creating the tmjconnect_api role.
-- =================================================================================

-- Create the restricted API role (run once at DB provisioning time):
-- CREATE ROLE tmjconnect_api LOGIN PASSWORD 'change_this_strong_password';
-- GRANT CONNECT ON DATABASE tmjconnect TO tmjconnect_api;
-- GRANT USAGE ON SCHEMA public TO tmjconnect_api;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tmjconnect_api;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tmjconnect_api;

-- HIPAA: Make audit_logs append-only at the database level.
-- The tmjconnect_api role can only INSERT — not UPDATE or DELETE.
-- REVOKE UPDATE, DELETE ON audit_logs FROM tmjconnect_api;

-- HIPAA: Prevent deletion of login_events (security monitoring records).
-- REVOKE DELETE ON login_events FROM tmjconnect_api;

-- NOTE: The REVOKE statements above are commented out because they must be run
-- by a superuser after the tmjconnect_api role is created. A role cannot revoke
-- its own privileges, and the migration runs as tmjconnect_api.
-- The authoritative procedure is in docs/RUNBOOK.md § 1.2 — apply the REVOKE
-- statements there during initial production setup. Without them, the HIPAA
-- append-only audit log requirement is NOT in effect.
