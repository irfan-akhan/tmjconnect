-- Migration: Transactional outbox for external notification channels.
--
-- See apps/api/src/db/schema/notifications.ts and apps/api/src/services/notify.ts
-- for the full design. The TL;DR: external notifications (email/SMS/push) are
-- now persisted to this table BEFORE dispatch, so a Resend/Twilio/FCM outage
-- can no longer lose user-facing notifications.

CREATE TYPE outbox_channel AS ENUM ('email', 'sms', 'push');

CREATE TABLE notification_outbox (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         outbox_channel NOT NULL,
  type            VARCHAR(50) NOT NULL,
  payload         JSONB NOT NULL,
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at         TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The drain job's only query: pending rows whose next attempt time has passed.
-- Partial index keeps it tight — sent rows are excluded entirely.
CREATE INDEX idx_outbox_pending
  ON notification_outbox(next_attempt_at)
  WHERE sent_at IS NULL;

-- For DLQ inspection / monitoring queries.
CREATE INDEX idx_outbox_dlq
  ON notification_outbox(user_id, created_at)
  WHERE sent_at IS NULL;
