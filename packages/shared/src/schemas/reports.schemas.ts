import { z } from 'zod';
import { freeText, optionalFreeText } from '../utils/zodHelpers';
import { commonListQuerySchema } from './common.schemas';

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

// ─── Report inbox query (provider) ────────────────────────────────────────────────
export const reportInboxQuerySchema = commonListQuerySchema.extend({
  status: z.enum(['submitted', 'viewed', 'reviewed', 'responded']).optional(),
  patient_id: z.string().uuid().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  urgency: z.enum(['routine', 'concerning', 'urgent']).optional(),
  sortBy: z.enum(['created_at', 'urgency', 'status']).optional(),
});

// ─── Patient's own reports query ───────────────────────────────────────────────────
export const patientReportsListQuerySchema = commonListQuerySchema.extend({
  urgency: z.enum(['routine', 'concerning', 'urgent']).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sortBy: z.enum(['created_at', 'urgency']).optional(),
});

// ─── Clinical notes (provider-only; about a patient, never patient-visible) ────────
export const createClinicalNoteSchema = z.object({
  body: freeText(1, 10000),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export const updateClinicalNoteSchema = z.object({
  body: freeText(1, 10000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const noteListQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'updated_at']).optional(),
});

// ─── Report requests (provider → patient nudge) ────────────────────────────────────
export const createReportRequestSchema = z.object({
  prompt: freeText(1, 2000),
});

export const reportRequestListQuerySchema = commonListQuerySchema.extend({
  status: z.enum(['pending', 'fulfilled', 'dismissed']).optional(),
  patient_id: z.string().uuid().optional(),
  sortBy: z.enum(['created_at', 'status']).optional(),
});

// ─── Provider on-behalf-of report ──────────────────────────────────────────────────
export const providerCreateReportSchema = z.object({
  urgency: z.enum(['routine', 'concerning', 'urgent']),
  pain_level: z.number().int().min(0).max(10).optional().nullable(),
  description: freeText(1, 10000),
  photo_url: z.string().url().optional().nullable(),
  period_start: z.string().datetime().optional().nullable(),
  period_end: z.string().datetime().optional().nullable(),
  patient_notes: optionalFreeText(5000),
  fulfilling_request_id: z.string().uuid().optional(),
});
