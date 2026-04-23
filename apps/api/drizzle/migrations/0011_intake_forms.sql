-- Intake Forms: provider-built questionnaires assigned to patients
-- Fields are stored as JSONB arrays with typed field definitions

CREATE TABLE intake_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  -- Array of field definitions: [{type, label, options?, required, order}]
  fields JSONB NOT NULL DEFAULT '[]',
  -- 'draft' = not visible to patients, 'published' = assignable
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_forms_provider ON intake_forms (provider_id) WHERE status != 'archived';

CREATE TABLE intake_form_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES intake_forms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'pending' = patient hasn't filled it out, 'completed' = response submitted
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'dismissed')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (form_id, patient_id)
);

CREATE INDEX idx_intake_assignments_patient ON intake_form_assignments (patient_id) WHERE status = 'pending';

CREATE TABLE intake_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES intake_form_assignments(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES intake_forms(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Structured answers: [{field_label, field_type, value}]
  answers JSONB NOT NULL DEFAULT '[]',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intake_responses_form ON intake_responses (form_id);
CREATE INDEX idx_intake_responses_patient ON intake_responses (patient_id);
