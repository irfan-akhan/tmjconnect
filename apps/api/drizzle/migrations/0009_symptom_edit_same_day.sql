-- 0009_symptom_edit_same_day.sql
--
-- Tightens the symptom-log edit window from "24 hours from creation" to
-- "same calendar day as creation" (UTC). Past-day logs become immutable.
--
-- The trigger name and attachment on symptom_logs stay the same — we just
-- replace the function body so the new check takes effect immediately.

CREATE OR REPLACE FUNCTION enforce_symptom_edit_window()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at::date <> CURRENT_DATE THEN
    RAISE EXCEPTION 'Symptom logs can only be edited on the day they were created.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
