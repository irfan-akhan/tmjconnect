import { pgTable, uuid, varchar, text, timestamp, jsonb, check, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const intakeForms = pgTable('intake_forms', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull().default(sql`'[]'`),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const intakeFormAssignments = pgTable('intake_form_assignments', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  form_id: uuid('form_id').notNull().references(() => intakeForms.id, { onDelete: 'cascade' }),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const intakeResponses = pgTable('intake_responses', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  assignment_id: uuid('assignment_id').notNull().references(() => intakeFormAssignments.id, { onDelete: 'cascade' }),
  form_id: uuid('form_id').notNull().references(() => intakeForms.id, { onDelete: 'cascade' }),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull().default(sql`'[]'`),
  submitted_at: timestamp('submitted_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
