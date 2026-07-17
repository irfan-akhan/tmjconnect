-- Tie each session to its login lineage (refresh-token family) so every distinct
-- login is its own "active session" row, instead of collapsing all logins from
-- one device (User-Agent) into a single session.
ALTER TABLE "sessions" ADD COLUMN "token_family" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_token_family_idx" ON "sessions" ("token_family");
