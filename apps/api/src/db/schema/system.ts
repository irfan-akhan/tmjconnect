import {
  pgTable,
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
