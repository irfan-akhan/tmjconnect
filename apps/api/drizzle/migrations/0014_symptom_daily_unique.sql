-- 0014_symptom_daily_unique.sql
--
-- Enforce one symptom log per patient per UTC calendar day.
--
-- 1) Deduplicate existing rows by keeping the latest log for each
--    (patient_id, UTC date(logged_at)) bucket.
-- 2) Add a unique index to make the invariant database-enforced.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id, ((logged_at AT TIME ZONE 'UTC')::date)
      ORDER BY logged_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM symptom_logs
)
DELETE FROM symptom_logs sl
USING ranked r
WHERE sl.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX idx_sl_patient_day_unique
  ON symptom_logs(patient_id, ((logged_at AT TIME ZONE 'UTC')::date));