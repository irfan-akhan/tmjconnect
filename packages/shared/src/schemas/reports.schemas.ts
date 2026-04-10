import { z } from 'zod';
import { freeText, optionalFreeText } from '../utils/zodHelpers';

// ─── Patient submission ──────────────────────────────────────────────────────────
export const submitReportSchema = z.object({
  provider_id: z.string().uuid(),
  urgency: z.enum(['routine', 'concerning', 'urgent']),
  pain_level: z.number().int().min(0).max(10).optional().nullable(),
  description: freeText(1, 10000),
  photo_url: z.string().url().optional().nullable(),
  period_start: z.string().datetime().optional().nullable(),
  period_end: z.string().datetime().optional().nullable(),
  patient_notes: optionalFreeText(5000),
});

// ─── Provider response ────────────────────────────────────────────────────────────
export const respondToReportSchema = z.object({
  message: freeText(1, 5000),
  internal_notes: optionalFreeText(5000),
});

// ─── Report inbox query ────────────────────────────────────────────────────────────
export const reportInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['submitted', 'viewed', 'reviewed', 'responded']).optional(),
  patient_id: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  urgency: z.enum(['routine', 'concerning', 'urgent']).optional(),
});
