import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── Enums ────────────────────────────────────────────────────────────────────────
export const urgencyEnum = pgEnum('urgency_level', ['routine', 'concerning', 'urgent']);
export const reportStatusEnum = pgEnum('report_status', [
  'submitted',
  'viewed',
  'reviewed',
  'responded',
]);

// ─── symptom_logs ─────────────────────────────────────────────────────────────────
// Daily patient symptom entries. Entire table is core PHI.
//
// Edit window: a BEFORE UPDATE trigger (applied in migration) enforces that
// edits are only allowed within 24 hours of created_at (server-set, immutable).
// The window is anchored to created_at — NOT logged_at (client-provided) —
// to prevent patients from backdating entries to exploit the window.
//
// One log per patient per day: route uses ON CONFLICT (patient_id, DATE(logged_at))
// DO UPDATE to upsert. Zod validates logged_at is within ±24h of now.
export const symptomLogs = pgTable('symptom_logs', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 0–10 pain scale. DB CHECK constraint enforces range.
  pain_level: integer('pain_level').notNull(),
  // e.g. ['aching', 'sharp', 'throbbing']
  pain_types: text('pain_types').array().notNull().default(sql`'{}'`),
  // e.g. [{"area": "jaw", "side": "left"}]
  body_areas: jsonb('body_areas').notNull().default(sql`'[]'`),
  duration_minutes: integer('duration_minutes'),
  // e.g. ['chewing', 'stress', 'cold']
  triggers: text('triggers').array().notNull().default(sql`'{}'`),
  // Free text. HTML-stripped by the freeText helper in @tmjconnect/shared before storage.
  notes: text('notes'),
  // Client-provided timestamp. Constrained to ±24h by Zod validation in route.
  logged_at: timestamp('logged_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // Server-set. Immutable after insert. Anchor for the 24-hour edit window trigger.
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // Editable within 24 hours of created_at only (enforced by DB trigger in migration).
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => ({
  painLevelCheck: check('pain_level_range', sql`${table.pain_level} BETWEEN 0 AND 10`),
}));

// ─── reports ──────────────────────────────────────────────────────────────────────
// Patient-to-provider periodic health reports. Core PHI.
//
// provider_id uses ON DELETE SET NULL: when a provider is hard-deleted by cleanupJob,
// their provider_id is set to NULL on all reports — preserving patient history.
// The cleanupJob explicitly performs this SET NULL before hard-deleting the user.
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // ON DELETE SET NULL: report history preserved even if provider is deleted.
  provider_id: uuid('provider_id').references(() => users.id, { onDelete: 'set null' }),
  urgency: urgencyEnum('urgency').notNull(),
  pain_level: integer('pain_level'),
  // PHI. HTML-stripped by the freeText helper in @tmjconnect/shared before storage.
  description: text('description').notNull(),
  photo_url: text('photo_url'),
  period_start: timestamp('period_start', { withTimezone: true }),
  period_end: timestamp('period_end', { withTimezone: true }),
  // Auto-generated stats snapshot at time of submission.
  summary_data: jsonb('summary_data').notNull().default(sql`'{}'`),
  // PHI. HTML-stripped by the freeText helper in @tmjconnect/shared before storage.
  patient_notes: text('patient_notes'),
  status: reportStatusEnum('status').notNull().default('submitted'),
  flagged: boolean('flagged').notNull().default(false),
  submitted_at: timestamp('submitted_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  viewed_at: timestamp('viewed_at', { withTimezone: true }),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
}, (table) => ({
  painLevelCheck: check('report_pain_level_range', sql`${table.pain_level} IS NULL OR ${table.pain_level} BETWEEN 0 AND 10`),
}));

// ─── report_responses ─────────────────────────────────────────────────────────────
// Provider text responses to a report. Multiple responses per report are allowed.
// Patients see all responses in chronological order. internal_notes are NEVER
// returned in patient-facing API responses.
//
// provider_id uses ON DELETE SET NULL: same rationale as reports.provider_id.
export const reportResponses = pgTable('report_responses', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  report_id: uuid('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  // ON DELETE SET NULL: response history preserved even if provider is deleted.
  provider_id: uuid('provider_id').references(() => users.id, { onDelete: 'set null' }),
  // Visible to patient. PHI. Sanitised.
  message: text('message').notNull(),
  // Provider-only. NEVER returned in patient-facing responses. Omitted at query level.
  internal_notes: text('internal_notes'),
  responded_at: timestamp('responded_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
