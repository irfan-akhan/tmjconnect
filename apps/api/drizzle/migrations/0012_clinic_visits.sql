-- clinic_visits: in-clinic encounters between a provider and a linked patient.
-- Used by the provider portal to surface "last clinic visit" context on
-- patient screens (report detail, dashboard). Recorded by the provider after
-- the visit; patients do not write to this table.
--
-- Scope: provider must be actively linked to the patient at the time the row
-- is created. Enforcement is in the use-case layer; the DB only checks FKs.

CREATE TABLE IF NOT EXISTS clinic_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Most reads are "latest visit for this patient" — index supports it directly.
CREATE INDEX IF NOT EXISTS idx_clinic_visits_patient_visited_at
  ON clinic_visits (patient_id, visited_at DESC);

-- Provider's own visit history (for future analytics / auditing).
CREATE INDEX IF NOT EXISTS idx_clinic_visits_provider_visited_at
  ON clinic_visits (provider_id, visited_at DESC);

CREATE TRIGGER trg_clinic_visits_updated_at
  BEFORE UPDATE ON clinic_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
