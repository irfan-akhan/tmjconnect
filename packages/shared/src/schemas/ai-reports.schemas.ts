import { z } from 'zod';
import { optionalFreeText } from '../utils/zodHelpers';
import { commonListQuerySchema } from './common.schemas';
import {
  AI_REPORT_TYPES,
  AI_REPORT_STATUSES,
  AI_REPORT_DISCARD_REASONS,
} from '../constants';

/**
 * Clinical report content schemas.
 *
 * Used in two places:
 *  1. Validating the JSON Claude returns at generation time (structural check).
 *  2. Validating the `content` a provider submits when editing a draft (PATCH /edit).
 *
 * Section bodies are bounded prose. HTML is NOT stripped here — the PDF renderer
 * writes section text via `textContent`, never `innerHTML`, so there is no injection
 * surface, and we want to preserve the model's / provider's exact wording.
 */
const sectionText = z.string().min(1).max(20000);

// ─── Report sections (progress report) ──────────────────────────────────────────────
export const reportSectionsSchema = z.object({
  clinical_summary: sectionText,
  pain_trajectory: sectionText,
  functional_assessment: sectionText,
  exercise_adherence_and_response: sectionText,
  biopsychosocial_observations: sectionText,
  red_flags: sectionText.nullable(),
  clinical_impression: sectionText,
  plan_and_recommendations: sectionText,
});

// ─── Report sections (treatment summary = progress + 3 historical sections) ─────────
export const treatmentSummarySectionsSchema = reportSectionsSchema.extend({
  treatment_history: sectionText,
  diagnosis_context: sectionText,
  overall_treatment_response: sectionText,
});

// ─── Full report content envelope ───────────────────────────────────────────────────
export const reportContentSchema = z.object({
  report_title: z.string().min(1).max(500),
  patient_name: z.string().min(1).max(200),
  provider_name: z.string().min(1).max(200),
  provider_credentials: z.string().min(1).max(200),
  clinic_name: z.string().min(1).max(200),
  date_range: z.string().min(1).max(100),
  generated_at: z.string().min(1).max(100),
  report_type: z.enum(AI_REPORT_TYPES),
  red_flags_detected: z.boolean(),
  // Treatment-summary sections are a superset; try the richer schema first so a
  // progress payload (missing the 3 extra sections) falls through to the base shape.
  sections: z.union([treatmentSummarySectionsSchema, reportSectionsSchema]),
  data_quality_note: z.string().min(1).max(5000).nullable(),
});

// ─── Generate (provider) ────────────────────────────────────────────────────────────
export const generateAiReportSchema = z
  .object({
    patientId: z.string().uuid(),
    reportType: z.enum(AI_REPORT_TYPES),
    dateStart: z.string().date(), // YYYY-MM-DD
    dateEnd: z.string().date(),
  })
  .refine((d) => d.dateStart <= d.dateEnd, {
    message: 'dateStart must be on or before dateEnd',
    path: ['dateStart'],
  });

// ─── Edit (provider) ────────────────────────────────────────────────────────────────
export const editAiReportSchema = z.object({
  content: reportContentSchema,
});

// ─── Discard (provider) ─────────────────────────────────────────────────────────────
export const discardAiReportSchema = z.object({
  reason: z.enum(AI_REPORT_DISCARD_REASONS),
  notes: optionalFreeText(2000),
});

// ─── Per-patient report list query (provider) ───────────────────────────────────────
export const aiReportPatientListQuerySchema = commonListQuerySchema.extend({
  status: z.enum(AI_REPORT_STATUSES).optional(),
  report_type: z.enum(AI_REPORT_TYPES).optional(),
  sortBy: z.enum(['created_at', 'approved_at']).optional(),
});
