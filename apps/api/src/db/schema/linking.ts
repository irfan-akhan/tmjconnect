import { pgTable, uuid, varchar, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── Enums ────────────────────────────────────────────────────────────────────────
export const linkingCodeStatusEnum = pgEnum('linking_code_status', [
  'pending',
  'connected',
  'expired',
]);

// ─── linking_codes ────────────────────────────────────────────────────────────────
// Provider-generated patient invite codes. 6-char alphanumeric. 7-day expiry.
// On unique constraint violation during generation, the route retries up to 3 times.
export const linkingCodes = pgTable('linking_codes', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  // 6-char alphanumeric code. UNIQUE index enforced by migration.
  code: varchar('code', { length: 6 }).notNull().unique(),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Nullable until patient accepts. Set to patient user_id on acceptance.
  patient_id: uuid('patient_id').references(() => users.id, { onDelete: 'set null' }),
  status: linkingCodeStatusEnum('status').notNull().default('pending'),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().default(sql`NOW()`),
});

// ─── patient_provider_links ───────────────────────────────────────────────────────
// Active patient-provider connections. Soft-deleted on disconnect (sets unlinked_at).
// Partial UNIQUE constraint on (patient_id, provider_id) WHERE unlinked_at IS NULL
// prevents duplicate active links while allowing re-linking after disconnect.
export const patientProviderLinks = pgTable('patient_provider_links', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  patient_id: uuid('patient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider_id: uuid('provider_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  linked_at: timestamp('linked_at', { withTimezone: true }).notNull().default(sql`NOW()`),
  // Nullable. Set to NOW() on disconnect. NULL = active link.
  unlinked_at: timestamp('unlinked_at', { withTimezone: true }),
  // Patient-granted scope of what the provider can see. Only 'full_clinical' today.
  consent_scope: varchar('consent_scope', { length: 20 }).notNull().default('full_clinical'),
  // Provider's working diagnosis for this patient. Tied to the link, not the patient,
  // so it is severed when the link is unlinked.
  diagnosis: text('diagnosis'),
});
