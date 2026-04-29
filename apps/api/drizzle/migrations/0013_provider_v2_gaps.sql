-- 0013_provider_v2_gaps.sql
-- Closes provider portal v2 integration gaps: consent scope and diagnosis on
-- patient links, support ticket inbox, and structural support for richer
-- patient-detail aggregations (no new tables needed for those — they piggyback
-- on existing symptom_logs / exercise_completions / reports).

-- ── patient_provider_links: consent scope + diagnosis ───────────────────────
-- consent_scope captures what the patient has agreed the provider can see.
-- 'full_clinical' is the only scope today; future values will narrow it.
-- diagnosis is a free-text working diagnosis the provider records per link;
-- intentionally NOT a separate table so it disappears when the link is severed.
ALTER TABLE patient_provider_links
  ADD COLUMN IF NOT EXISTS consent_scope VARCHAR(20) NOT NULL DEFAULT 'full_clinical',
  ADD COLUMN IF NOT EXISTS diagnosis TEXT;

-- ── support_tickets ─────────────────────────────────────────────────────────
-- Provider-submitted help/support requests. Status is operator-only — patients
-- never see this table. attach_diagnostic flags client-side log inclusion;
-- the actual log ingestion is out of scope for v1.
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(40) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  attach_diagnostic BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created_at
  ON support_tickets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created_at
  ON support_tickets (status, created_at DESC);

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes for new aggregations ────────────────────────────────────────────
-- Disconnection lookups by provider over a recent window.
CREATE INDEX IF NOT EXISTS idx_patient_provider_links_provider_unlinked_at
  ON patient_provider_links (provider_id, unlinked_at)
  WHERE unlinked_at IS NOT NULL;
