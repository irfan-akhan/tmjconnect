import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  inet,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── audit_logs ───────────────────────────────────────────────────────────────────
// HIPAA-required immutable audit trail. Append-only.
//
// CRITICAL CONSTRAINTS (enforced at DB level via migration):
//   1. The tmjconnect_api DB role has only INSERT on this table (UPDATE/DELETE revoked).
//   2. user_id uses ON DELETE SET NULL — audit rows are NEVER deleted when a user is deleted.
//   3. cleanupJob must NEVER touch this table.
//   4. Minimum 6-year retention required by HIPAA.
//
// metadata must never contain raw PHI values (only record IDs and aggregate stats).
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  // ON DELETE SET NULL: audit rows retained with user_id = NULL after hard-delete.
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  // e.g. 'patient.symptoms.create', 'auth.login.failed', 'provider.report.respond'
  action: varchar('action', { length: 100 }).notNull(),
  // e.g. 'symptom_log', 'report', 'user'
  resource_type: varchar('resource_type', { length: 50 }),
  resource_id: uuid('resource_id'),
  ip_address: inet('ip_address'),
  user_agent: text('user_agent'),
  // Contextual data. NEVER store raw PHI here. Log IDs and aggregate values only.
  // e.g. { "pain_level": 7, "requestId": "uuid" }
  metadata: jsonb('metadata').notNull().default(sql`'{}'`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── login_events ─────────────────────────────────────────────────────────────────
// Login history for security monitoring and account lockout checks.
// email stored separately so failed login events are recorded even if user_id is unknown.
// user_id uses ON DELETE SET NULL: events retained for monitoring after user deletion.
export const loginEvents = pgTable('login_events', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  // ON DELETE SET NULL: login events retained after user hard-delete.
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  // Stored separately: failed logins recorded even for non-existent email attempts.
  email: varchar('email', { length: 255 }).notNull(),
  success: boolean('success').notNull(),
  ip_address: inet('ip_address'),
  device_info: text('device_info'),
  // e.g. 'invalid_password', 'account_locked', 'email_not_verified'
  failure_reason: varchar('failure_reason', { length: 100 }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── idempotency_keys ─────────────────────────────────────────────────────────────
// Stores responses for idempotent POST requests (Idempotency-Key header).
// response_body stores ONLY { status, resourceId } — NEVER the full response body.
// This prevents the idempotency cache from becoming an uncontrolled PHI store.
// codeExpiryJob cleans up expired keys hourly.
export const idempotencyKeys = pgTable('idempotency_keys', {
  // Client-provided Idempotency-Key header value (UUID recommended).
  key: varchar('key', { length: 64 }).primaryKey(),
  // HTTP status code of the original response.
  response_status: integer('response_status').notNull(),
  // Stores only { status: string, resourceId: string }. Never the full response.
  response_body: jsonb('response_body').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // 24-hour expiry. Cleaned up by codeExpiryJob.
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ─── job_runs ────────────────────────────────────────────────────────────────────
// Tracks every scheduled job execution for the admin "Job runner health" panel.
// Rows are pruned after 30 days by the cleanupJob.

export const jobStatusEnum = pgEnum('job_status', ['running', 'success', 'failed', 'skipped']);

// ─── broadcasts ──────────────────────────────────────────────────────────────────
// Admin broadcast messages sent to platform users.
export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  created_by: uuid('created_by').notNull().references(() => users.id, { onDelete: 'set null' }),
  audience: varchar('audience', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  channels: text('channels').array().notNull(),
  recipient_count: integer('recipient_count').notNull().default(0),
  scheduled_at: timestamp('scheduled_at', { withTimezone: true }),
  sent_at: timestamp('sent_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── scheduled_reports ───────────────────────────────────────────────────────────
// Recurring CSV export jobs created by admins.
export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  created_by: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  entity: varchar('entity', { length: 50 }).notNull(),
  filters: jsonb('filters').notNull().default(sql`'{}'`),
  cadence: varchar('cadence', { length: 20 }).notNull(),
  recipient_emails: text('recipient_emails').array().notNull(),
  next_run_at: timestamp('next_run_at', { withTimezone: true }).notNull(),
  last_run_at: timestamp('last_run_at', { withTimezone: true }),
  enabled: boolean('enabled').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── feature_flags ───────────────────────────────────────────────────────────────
// Simple feature flag system for gradual rollouts.
export const featureFlags = pgTable('feature_flags', {
  key: varchar('key', { length: 100 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  rollout_percent: integer('rollout_percent').notNull().default(0),
  target_roles: text('target_roles').array(),
  updated_by: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── support_tickets ─────────────────────────────────────────────────────────────
// Provider-submitted help/support requests. Status is operator-only — patients
// never see this table. Backed by migration 0013.
export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 40 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  body: text('body').notNull(),
  attach_diagnostic: boolean('attach_diagnostic').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── account_restore_requests ─────────────────────────────────────────────────
// Deleted users can request an admin review after the self-restore window has passed.
export const accountRestoreRequests = pgTable('account_restore_requests', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reason: text('reason'),
  requested_at: timestamp('requested_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
  reviewed_by: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  decision_note: text('decision_note'),
});

// ─── job_runs ────────────────────────────────────────────────────────────────────
export const jobRuns = pgTable('job_runs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  job_name: varchar('job_name', { length: 50 }).notNull(),
  status: jobStatusEnum('status').notNull(),
  started_at: timestamp('started_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  finished_at: timestamp('finished_at', { withTimezone: true }),
  duration_ms: integer('duration_ms'),
  rows_affected: integer('rows_affected'),
  error_message: text('error_message'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
