import { pgTable, uuid, varchar, timestamp, integer, text, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── Enums ────────────────────────────────────────────────────────────────────────
export const assignmentStatusEnum = pgEnum('assignment_status', [
  'active',
  'paused',
  'completed',
]);

// ─── exercises ────────────────────────────────────────────────────────────────────
// Exercise video library. Each exercise is owned by a provider.
// description and instructions are plain text for MVP (no rich text editor).
// HTML stripping runs on these fields via the freeText helper in
// @tmjconnect/shared (single code path for all free-text).
export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  duration_seconds: integer('duration_seconds'),
  category: varchar('category', { length: 100 }),
  instructions: text('instructions'),
  video_url: text('video_url'),
  thumbnail_url: text('thumbnail_url'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── exercise_assignments ─────────────────────────────────────────────────────────
// A provider assigns an exercise to one of their linked patients.
// Cascades to exercise_completions on delete.
export const exerciseAssignments = pgTable('exercise_assignments', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  exercise_id: uuid('exercise_id').notNull().references(() => exercises.id, { onDelete: 'cascade' }),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // e.g. 'daily', '3x weekly'. Plain text for MVP flexibility.
  frequency: varchar('frequency', { length: 50 }).notNull().default('daily'),
  sets: integer('sets').notNull().default(1),
  status: assignmentStatusEnum('status').notNull().default('active'),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── exercise_completions ─────────────────────────────────────────────────────────
// Patient marks a daily exercise completion.
// UNIQUE constraint on (assignment_id, patient_id, DATE(completed_at)) prevents
// double-counting completions on the same calendar day.
export const exerciseCompletions = pgTable('exercise_completions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  assignment_id: uuid('assignment_id').notNull().references(() => exerciseAssignments.id, { onDelete: 'cascade' }),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  completed_at: timestamp('completed_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
