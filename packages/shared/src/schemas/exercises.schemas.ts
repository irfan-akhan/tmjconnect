import { z } from 'zod';
import { freeText, optionalFreeText } from '../utils/zodHelpers';
import { commonListQuerySchema } from './common.schemas';

// ─── Exercise ─────────────────────────────────────────────────────────────────────
export const createExerciseSchema = z.object({
  title: freeText(1, 255),
  description: optionalFreeText(5000),
  duration_seconds: z.number().int().min(1).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  instructions: optionalFreeText(10000),
  video_url: z.string().url().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
});

export const updateExerciseSchema = createExerciseSchema.partial();

// ─── Assignment ───────────────────────────────────────────────────────────────────
export const createAssignmentSchema = z.object({
  exercise_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  frequency: z.string().max(50).default('daily'),
  sets: z.number().int().min(1).default(1),
});

export const updateAssignmentSchema = z.object({
  frequency: z.string().max(50).optional(),
  sets: z.number().int().min(1).optional(),
  status: z.enum(['active', 'paused', 'completed']).optional(),
});

// ─── Exercise list query (provider side) ───────────────────────────────────────────────────────────
export const exerciseListQuerySchema = commonListQuerySchema.extend({
  category: z.string().max(100).optional(),
  sortBy: z.enum(['created_at', 'title', 'category']).optional(),
});

// ─── Assignment list query (patient side) ────────────────────────────────────────────────────────
export const assignmentListQuerySchema = commonListQuerySchema.extend({
  status: z.enum(['active', 'paused', 'completed']).optional(),
});
