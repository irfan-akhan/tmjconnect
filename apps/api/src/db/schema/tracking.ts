import { pgTable, uuid, integer, text, timestamp, boolean, numeric, varchar, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const jawMobilityLogs = pgTable('jaw_mobility_logs', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  measurement_mm: integer('measurement_mm').notNull(),
  method: varchar('method', { length: 20 }).notNull().default('fingers'),
  notes: text('notes'),
  logged_at: timestamp('logged_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => ({
  measurementCheck: check('measurement_mm_range', sql`${table.measurement_mm} BETWEEN 1 AND 80`),
}));

export const medicationLogs = pgTable('medication_logs', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  medication_name: varchar('medication_name', { length: 120 }).notNull(),
  dosage: varchar('dosage', { length: 60 }),
  logged_at: timestamp('logged_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

export const sleepLogs = pgTable('sleep_logs', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  quality: integer('quality').notNull(),
  hours_slept: numeric('hours_slept', { precision: 3, scale: 1 }),
  bruxism_aware: boolean('bruxism_aware').notNull().default(false),
  morning_stiffness: integer('morning_stiffness'),
  notes: text('notes'),
  logged_at: timestamp('logged_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
}, (table) => ({
  qualityCheck: check('quality_range', sql`${table.quality} BETWEEN 1 AND 5`),
  stiffnessCheck: check('stiffness_range', sql`${table.morning_stiffness} IS NULL OR ${table.morning_stiffness} BETWEEN 0 AND 10`),
}));
