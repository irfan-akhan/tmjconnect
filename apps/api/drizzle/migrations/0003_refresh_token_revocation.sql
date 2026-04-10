-- Migration: Add revoked_at column to refresh_tokens for replay/reuse detection.
--
-- The application no longer DELETEs rotated refresh tokens — it sets revoked_at
-- instead. This lets a replay attempt (using a token that was already rotated)
-- be distinguished from a random/forged token, which is the only way to detect
-- refresh token theft.
--
-- See apps/api/src/db/schema/auth.ts for the full reuse-detection flow.

ALTER TABLE refresh_tokens
  ADD COLUMN revoked_at TIMESTAMPTZ;

-- Optional partial index: only active tokens are looked up on every refresh.
-- WHERE revoked_at IS NULL keeps the index small (revoked rows are pruned by
-- the cleanup job after they expire).
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active_hash
  ON refresh_tokens(token_hash)
  WHERE revoked_at IS NULL;

-- Index for the family-burn operation: when a replay is detected, we need to
-- mark every token in the family revoked.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
  ON refresh_tokens(token_family);
