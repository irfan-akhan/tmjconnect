CREATE TYPE exercise_owner_type AS ENUM ('platform', 'provider');
CREATE TYPE exercise_status AS ENUM ('draft', 'published', 'archived');

ALTER TABLE exercises
  ADD COLUMN owner_type exercise_owner_type NOT NULL DEFAULT 'provider',
  ADD COLUMN status exercise_status NOT NULL DEFAULT 'published';

ALTER TABLE exercises
  ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE exercises
  ADD CONSTRAINT exercises_owner_provider_check CHECK (
    (owner_type = 'provider' AND provider_id IS NOT NULL)
    OR (owner_type = 'platform' AND provider_id IS NULL)
  );

CREATE INDEX idx_exercises_platform_published
  ON exercises (status, category, created_at DESC)
  WHERE owner_type = 'platform';

CREATE INDEX idx_exercises_provider_library
  ON exercises (provider_id, category, created_at DESC)
  WHERE owner_type = 'provider';