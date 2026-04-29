import { z } from 'zod';

// ─── Update Profile ───────────────────────────────────────────────────────────────
export const updateProviderProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  timezone: z.string().max(50).optional(),
  license_number: z.string().max(100).optional(),
  license_type: z.string().max(100).optional(),
  specialty: z.string().max(100).optional(),
  clinic_name: z.string().max(200).optional(),
  credentials: z.array(z.string().max(100)).max(20).optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

// ─── Patient list query ────────────────────────────────────────────────────────────
export const patientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
});

// ─── Linking ──────────────────────────────────────────────────────────────────────
export const emailInviteSchema = z.object({
  patient_email: z.string().email().toLowerCase(),
  patient_name: z.string().max(200).optional(),
});

// ─── Clinic visits ───────────────────────────────────────────────────────────────
// Provider records an in-clinic encounter with a linked patient. Used to drive
// the "last clinic visit" context surface on report-detail and patient-detail.
export const recordClinicVisitSchema = z.object({
  visited_at: z
    .string()
    .datetime({ offset: true })
    .refine((s) => new Date(s).getTime() <= Date.now() + 60_000, {
      message: 'visited_at cannot be in the future',
    }),
  notes: z.string().max(2000).optional().nullable(),
});

// ─── Patient link metadata (provider's working diagnosis) ────────────────────
export const updatePatientLinkSchema = z.object({
  diagnosis: z.string().max(500).optional().nullable(),
});

// ─── Notification preferences (provider) ─────────────────────────────────────
export const updateProviderNotificationPrefsSchema = z.object({
  exercise_reminders: z.boolean().optional(),
  symptom_checkin: z.boolean().optional(),
  provider_messages: z.boolean().optional(),
  report_updates: z.boolean().optional(),
  tips_updates: z.boolean().optional(),
  email_digest: z.enum(['instant', 'daily', 'weekly', 'off']).optional(),
});

// ─── Support ticket ──────────────────────────────────────────────────────────
export const createSupportTicketSchema = z.object({
  category: z.enum(['technical', 'billing', 'clinical', 'feature', 'other']),
  subject: z.string().min(3).max(255),
  body: z.string().min(10).max(10000),
  attach_diagnostic: z.boolean().optional().default(false),
});

