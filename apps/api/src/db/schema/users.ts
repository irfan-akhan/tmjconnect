import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  text,
  date,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum('user_role', ['patient', 'provider', 'admin']);

// ─── users ────────────────────────────────────────────────────────────────────────
// Core account table for all roles. PHI columns: email, phone.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  phone: varchar('phone', { length: 20 }),
  email_verified: boolean('email_verified').notNull().default(false),
  // 6-digit verification code. Encrypted at rest with AES-256-GCM using MFA_ENCRYPTION_KEY.
  email_verify_code: text('email_verify_code'),
  email_verify_expires: timestamp('email_verify_expires', { withTimezone: true }),
  // Pending email change flow — populated by /auth/change-email/request,
  // cleared on /auth/change-email/verify success. Uses the same encryption
  // scheme as email_verify_code for the stored code.
  pending_email: varchar('pending_email', { length: 255 }),
  pending_email_code: text('pending_email_code'),
  pending_email_expires: timestamp('pending_email_expires', { withTimezone: true }),
  // TOTP secret encrypted at rest with AES-256-GCM using MFA_ENCRYPTION_KEY.
  mfa_secret: text('mfa_secret'),
  mfa_enabled: boolean('mfa_enabled').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  fcm_token: text('fcm_token'),
  tos_accepted_at: timestamp('tos_accepted_at', { withTimezone: true }),
  tos_version: varchar('tos_version', { length: 10 }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // Soft delete. NULL = active. Set to NOW() when user requests deletion.
  deleted_at: timestamp('deleted_at', { withTimezone: true }),
});

// ─── profiles ─────────────────────────────────────────────────────────────────────
// Extended user info. All columns are PHI (demographic identifiers).
// All fields are blanked by cleanupJob before hard-delete.
export const profiles = pgTable('profiles', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  date_of_birth: date('date_of_birth'),
  gender: varchar('gender', { length: 20 }),
  avatar_url: text('avatar_url'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  // IANA timezone string (e.g. 'America/New_York'). Used for reminders and digest timing.
  timezone: varchar('timezone', { length: 50 }).notNull().default('America/Chicago'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── provider_details ─────────────────────────────────────────────────────────────
// Professional details for provider accounts only.
export const providerDetails = pgTable('provider_details', {
  user_id: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  license_number: varchar('license_number', { length: 100 }).notNull(),
  license_type: varchar('license_type', { length: 100 }).notNull(),
  specialty: varchar('specialty', { length: 100 }).notNull(),
  clinic_name: varchar('clinic_name', { length: 200 }).notNull(),
  // Professional titles/credentials (e.g. ['DDS', 'CCMC']). PostgreSQL TEXT[].
  credentials: text('credentials').array(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
