import { z } from 'zod';
import { commonListQuerySchema } from './common.schemas';

export const intakeFormListQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['updated_at', 'created_at', 'title', 'status']).optional(),
});

export const intakeResponseListQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['submitted_at', 'patient_name']).optional(),
});

export const intakeAssignmentListQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['assigned_at', 'form_title', 'provider_name']).optional(),
});