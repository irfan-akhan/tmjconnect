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

