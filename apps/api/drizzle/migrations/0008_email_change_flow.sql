-- 0008_email_change_flow.sql
--
-- Adds the columns needed for the "change email" two-step verification flow.
-- The existing email_verify_code + email_verify_expires columns are used for
-- initial signup verification; we want a parallel set scoped to a PENDING
-- email change so the two flows don't collide (e.g. a user requesting an
-- email change right after signup, before they've verified the original).
--
-- Columns:
--   - pending_email         : the new address the user is trying to adopt
--   - pending_email_code    : AES-256-GCM encrypted 6-digit code (same
--                             encryption scheme as email_verify_code)
--   - pending_email_expires : TTL for the code — set to NOW() + 1 hour when
--                             the request is made
--
-- On successful verification, the handler copies pending_email → email and
-- nulls all three columns. On request-again, old values are overwritten.

ALTER TABLE users
  ADD COLUMN pending_email VARCHAR(255),
  ADD COLUMN pending_email_code TEXT,
  ADD COLUMN pending_email_expires TIMESTAMPTZ;

-- Indexing isn't necessary — we always look up by `users.id` from the
-- authenticated context, never by pending_email alone.
