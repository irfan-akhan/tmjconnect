import { z } from 'zod';
import { commonListQuerySchema } from './common.schemas';

export const adminUserListQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'email', 'role', 'is_active']).optional(),
  search: z.string().max(255).optional(),
  role: z.enum(['patient', 'provider', 'admin']).optional(),
  is_active: z.coerce.boolean().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const adminUpdateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role: z.enum(['patient', 'provider', 'admin']).optional(),
  force_password_reset: z.boolean().optional(),
  force_mfa_reset: z.boolean().optional(),
});

export const auditLogQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'action', 'resource_type']).optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  resource_type: z.string().max(50).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const auditLogExportQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
}).refine((data) => {
  const from = new Date(data.from);
  const to = new Date(data.to);
  const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 90 && diffDays >= 0;
}, 'Date range must be between 1 and 90 days');

export const loginEventQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'email', 'success']).optional(),
  user_id: z.string().uuid().optional(),
  success: z.coerce.boolean().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const adminReportsQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['submitted_at', 'urgency', 'status', 'pain_level']).optional(),
});

export const adminOutboxQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'next_attempt_at', 'attempts']).optional(),
  channel: z.enum(['email', 'sms', 'push']).optional(),
});

export const adminSessionsQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['last_active', 'created_at', 'user_email', 'user_role']).optional(),
  role: z.enum(['patient', 'provider', 'admin']).optional(),
});

export const adminJobHistoryQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['started_at', 'status', 'duration_ms']).optional(),
});
