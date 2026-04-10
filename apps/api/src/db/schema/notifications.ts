import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  time,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── Enums ────────────────────────────────────────────────────────────────────────
export const reminderTypeEnum = pgEnum('reminder_type', ['exercise', 'symptom']);
export const outboxChannelEnum = pgEnum('outbox_channel', ['email', 'sms', 'push']);
export const digestFrequencyEnum = pgEnum('digest_frequency', [
  'instant',
  'daily',
  'weekly',
  'off',
]);

// ─── notifications ────────────────────────────────────────────────────────────────
// In-app notification store. Created by notify() on every notification dispatch.
// body and data may contain clinical references — classified as PHI by association.
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Notification type determines channels dispatched. See notify.ts channel map.
  type: varchar('type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  // May contain clinical references. PHI by association.
  body: text('body').notNull(),
  // Extra payload for deep linking. e.g. { reportId: 'uuid' }
  data: jsonb('data').notNull().default(sql`'{}'`),
  read: boolean('read').notNull().default(false),
  read_at: timestamp('read_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── notification_preferences ─────────────────────────────────────────────────────
// Per-user channel and frequency preferences. Consulted by notify() on dispatch.
// next_digest_at is pre-computed to avoid per-row timezone math at runtime.
export const notificationPreferences = pgTable('notification_preferences', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  exercise_reminders: boolean('exercise_reminders').notNull().default(true),
  symptom_checkin: boolean('symptom_checkin').notNull().default(true),
  provider_messages: boolean('provider_messages').notNull().default(true),
  report_updates: boolean('report_updates').notNull().default(true),
  tips_updates: boolean('tips_updates').notNull().default(false),
  email_digest: digestFrequencyEnum('email_digest').notNull().default('instant'),
  // Pre-computed next UTC delivery time. weeklyDigestJob queries WHERE next_digest_at <= NOW().
  // Recalculated after each digest send and whenever profiles.timezone changes.
  next_digest_at: timestamp('next_digest_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── notification_outbox ──────────────────────────────────────────────────────────
// Transactional outbox for external notification channels (email, SMS, push).
//
// Why an outbox: prior to this table, notify() called Resend/Twilio/FCM
// fire-and-forget — a circuit breaker open or transient network failure meant
// the notification was lost forever. The outbox makes external dispatch durable:
//
//   1. notify() inserts one row per enabled channel inside the SAME transaction
//      as whatever business action triggered it (so the row exists if and only
//      if the trigger committed).
//   2. notify() then attempts immediate dispatch in the same request — on
//      success, sent_at is set; on failure, the row is left for the drain job.
//   3. outboxJob runs every minute, picks up unsent rows past their
//      next_attempt_at, dispatches via the appropriate channel, and either
//      marks sent or schedules the next retry with exponential backoff.
//   4. Rows that exhaust max_attempts stay in the table as a dead-letter queue.
//      Operators can inspect last_error and either replay or drop them.
//
// Pruned by the cleanup job after sent_at is older than 7 days.
export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channel: outboxChannelEnum('channel').notNull(),
  // Notification type drives template selection in the worker. Same vocabulary as notifications.type.
  type: varchar('type', { length: 50 }).notNull(),
  // Self-contained payload — title, body, recipient address, template data.
  // Stored as jsonb so the worker doesn't need to re-fetch user state at send time.
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(5),
  // When the next dispatch attempt should run. Set to NOW() on insert; pushed
  // forward by the worker on retry (exponential backoff).
  next_attempt_at: timestamp('next_attempt_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // Set when the dispatch succeeds. NULL = pending or failed.
  sent_at: timestamp('sent_at', { withTimezone: true }),
  // Last error message recorded by the worker. Helps debug DLQ rows.
  last_error: text('last_error'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── reminders ────────────────────────────────────────────────────────────────────
// Scheduled push reminders configured by the user.
// next_fire_at is pre-computed to avoid per-row timezone math in the reminderJob.
// reminderJob queries: WHERE next_fire_at <= NOW() AND enabled = true
// After firing, next_fire_at is recalculated to the next matching UTC time.
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: reminderTypeEnum('type').notNull(),
  // Stored in user's local time (from profiles.timezone). e.g. '09:00'
  time: time('time').notNull(),
  // Array of day codes. e.g. ["mon","tue","wed","thu","fri"]
  days: jsonb('days').notNull().default(sql`'["mon","tue","wed","thu","fri"]'`),
  enabled: boolean('enabled').notNull().default(true),
  // Pre-computed UTC fire time. Recalculated after each fire and on schedule change.
  next_fire_at: timestamp('next_fire_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
