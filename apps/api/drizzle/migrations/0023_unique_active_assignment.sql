-- One live assignment of an exercise per patient, PER PROVIDER.
--
-- Duplicates give the patient the same exercise as two separate cards, and
-- because completions are keyed to assignment_id the day's adherence splits
-- across the copies (one reads Done, the other Missed, for the same work).
--
-- Scoped by provider_id on purpose: exercises may be platform-owned
-- (owner_type = 'platform') and shared across the whole platform, so two
-- different providers treating the same patient must each be able to assign
-- the same exercise. Only a provider duplicating their OWN assignment is blocked.
--
-- Partial index: only 'active' and 'paused' reserve an exercise. A 'completed'
-- assignment is a finished course of treatment and may be prescribed again,
-- which also means a patient accumulates history without ever being blocked.

-- ─── 1. Resolve pre-existing duplicates ──────────────────────────────────────
-- Nothing prevented duplicates until now, so any that exist must be collapsed
-- before the unique index can be created.

CREATE TEMP TABLE _dupe_assignments ON COMMIT DROP AS
SELECT
  id,
  patient_id,
  FIRST_VALUE(id) OVER w AS keep_id,
  ROW_NUMBER()   OVER w AS rn
FROM exercise_assignments
WHERE status IN ('active', 'paused')
WINDOW w AS (
  PARTITION BY exercise_id, patient_id, provider_id
  -- Keep the earliest assignment: it holds the longest completion history.
  ORDER BY assigned_at ASC, id ASC
);

-- Re-parent completions from the losing rows onto the survivor, so history is
-- preserved rather than cascade-deleted. Skipped where the survivor already has
-- a completion for that UTC day, since idx_ec_daily_unique forbids two.
UPDATE exercise_completions ec
SET assignment_id = d.keep_id
FROM _dupe_assignments d
WHERE ec.assignment_id = d.id
  AND d.rn > 1
  AND NOT EXISTS (
    SELECT 1
    FROM exercise_completions survivor
    WHERE survivor.assignment_id = d.keep_id
      AND survivor.patient_id = ec.patient_id
      AND (survivor.completed_at AT TIME ZONE 'UTC')::date
          = (ec.completed_at AT TIME ZONE 'UTC')::date
  );

-- Remove the duplicate assignments. Any completion still attached is one whose
-- day is already represented on the survivor, so cascading it away loses no
-- information.
DELETE FROM exercise_assignments
WHERE id IN (SELECT id FROM _dupe_assignments WHERE rn > 1);

-- ─── 2. Enforce it ───────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_ea_unique_live_per_provider
  ON exercise_assignments(exercise_id, patient_id, provider_id)
  WHERE status IN ('active', 'paused');
