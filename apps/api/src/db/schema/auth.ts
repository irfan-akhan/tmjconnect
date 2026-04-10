import { pgTable, uuid, varchar, timestamp, boolean, inet, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── refresh_tokens ───────────────────────────────────────────────────────────────
// Stores all refresh tokens (active AND rotated/revoked) for reuse detection.
// Only the SHA-256 hash is stored — plaintext tokens are never persisted server-side.
//
// Reuse detection flow (the "burn the family" pattern):
//   1. On rotation, the old row is NOT deleted — it gets `revoked_at = NOW()` set.
//   2. On a refresh request, lookup by token_hash finds either:
//      a. an active row (revoked_at IS NULL)        → rotate normally
//      b. a revoked row (revoked_at IS NOT NULL)    → REPLAY DETECTED. The whole
//         token_family is revoked + the user is alerted via Sentry. The
//         attacker AND the legitimate user are both forced to re-login.
//      c. nothing                                   → unknown token, plain 401.
//   3. Revoked tokens are pruned by the cleanup job after their expires_at passes.
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256 hex of the opaque 64-byte random token. Index for fast lookup.
  token_hash: varchar('token_hash', { length: 64 }).notNull(),
  // All rotated tokens in one rotation chain share the same family ID.
  token_family: uuid('token_family').notNull(),
  device_info: text('device_info'),
  ip_address: inet('ip_address'),
  // 7 days for patients. Invalidated on session timeout for providers.
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  // Set to NOW() when this token is rotated or the family is burned. NULL = active.
  revoked_at: timestamp('revoked_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── sessions ─────────────────────────────────────────────────────────────────────
// Active login sessions. Tracks UI "logged in devices" and enforces
// the 15-minute provider inactivity timeout. Separate from refresh_tokens
// which handle rotation logic.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  device_info: text('device_info'),
  ip_address: inet('ip_address'),
  // Updated on every authenticated request. Used for 15-min provider inactivity check.
  last_active: timestamp('last_active', { withTimezone: true }).notNull().default(sql`NOW()`),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── mfa_backup_codes ─────────────────────────────────────────────────────────────
// One-time recovery codes for providers. Shown exactly once at MFA setup.
export const mfaBackupCodes = pgTable('mfa_backup_codes', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // bcrypt hash of the 10-char plaintext code.
  code_hash: varchar('code_hash', { length: 255 }).notNull(),
  used: boolean('used').notNull().default(false),
  used_at: timestamp('used_at', { withTimezone: true }),
});

// ─── password_resets ──────────────────────────────────────────────────────────────
// Password reset tokens. Expire after 1 hour and are marked used immediately on consumption.
export const passwordResets = pgTable('password_resets', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // SHA-256 hex of the opaque 64-byte random token sent in the email link.
  token_hash: varchar('token_hash', { length: 64 }).notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});
