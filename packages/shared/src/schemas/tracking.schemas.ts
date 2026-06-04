import { z } from 'zod';
import { optionalFreeText } from '../utils/zodHelpers';
import { commonListQuerySchema } from './common.schemas';

// ─── Jaw Mobility ────────────────────────────────────────────────────────────────
export const createMobilityLogSchema = z.object({
  measurement_mm: z.number().int().min(1).max(80),
  method: z.enum(['fingers', 'ruler', 'caliper']).default('fingers'),
  notes: optionalFreeText(1000),
});

// ─── Medication ──────────────────────────────────────────────────────────────────
export const createMedicationLogSchema = z.object({
  medication_name: z.string().min(1).max(120),
  dosage: z.string().max(60).optional().nullable(),
  notes: optionalFreeText(1000),
});

// ─── Sleep ───────────────────────────────────────────────────────────────────────
export const createSleepLogSchema = z.object({
  quality: z.number().int().min(1).max(5),
  hours_slept: z.number().min(0).max(24).optional().nullable(),
  bruxism_aware: z.boolean().default(false),
  morning_stiffness: z.number().int().min(0).max(10).optional().nullable(),
  notes: optionalFreeText(1000),
});

// ─── Shared query params (cursor-based) ──────────────────────────────────────────
export const trackingListQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const trackingTrendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ─── Offset-based list queries with filtering ────────────────────────────────────
export const mobilityListQuerySchema = commonListQuerySchema.extend({
  method: z.enum(['fingers', 'ruler', 'caliper']).optional(),
  sortBy: z.enum(['logged_at', 'measurement_mm']).optional(),
});

export const medicationListQuerySchema = commonListQuerySchema.extend({
  medication_name: z.string().max(120).optional(),
  sortBy: z.enum(['logged_at', 'medication_name']).optional(),
});

export const sleepListQuerySchema = commonListQuerySchema.extend({
  quality: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(['logged_at', 'quality']).optional(),
});
