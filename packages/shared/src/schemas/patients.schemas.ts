import { z } from 'zod';
import { freeText, optionalFreeText } from '../utils/zodHelpers';

// ─── Update Profile ───────────────────────────────────────────────────────────────
export const updatePatientProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  date_of_birth: z.string().date().optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  timezone: z.string().max(50).optional(),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

// ─── Symptom Log ─────────────────────────────────────────────────────────────────
const now = () => new Date();
const oneDayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

export const createSymptomLogSchema = z.object({
  pain_level: z.number().int().min(0).max(10),
  pain_types: z.array(z.string().max(50)).default([]),
  body_areas: z.array(z.object({
    area: z.string().max(50),
    side: z.enum(['left', 'right', 'both', 'center']).optional(),
  })).default([]),
  duration_minutes: z.number().int().min(0).optional().nullable(),
  triggers: z.array(z.string().max(50)).default([]),
  notes: optionalFreeText(2000),
  logged_at: z.string().datetime().refine((val) => {
    const date = new Date(val);
    return date >= oneDayAgo() && date <= now();
  }, 'logged_at must be within the last 24 hours and not in the future').optional(),
});

export const updateSymptomLogSchema = createSymptomLogSchema.partial();

export const symptomCalendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const symptomListQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Report ───────────────────────────────────────────────────────────────────────
export const createReportSchema = z.object({
  urgency: z.enum(['routine', 'concerning', 'urgent']),
  pain_level: z.number().int().min(0).max(10).optional().nullable(),
  description: freeText(1, 5000),
  photo_url: z.string().url().optional().nullable(),
  period_start: z.string().date().optional().nullable(),
  period_end: z.string().date().optional().nullable(),
  patient_notes: optionalFreeText(2000),
});

// ─── Reminder ─────────────────────────────────────────────────────────────────────
export const createReminderSchema = z.object({
  type: z.enum(['exercise', 'symptom']),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).min(1),
  enabled: z.boolean().default(true),
});

export const updateReminderSchema = createReminderSchema.partial();
