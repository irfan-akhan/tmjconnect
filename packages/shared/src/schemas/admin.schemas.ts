import { z } from 'zod';

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
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

export const loginEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  user_id: z.string().uuid().optional(),
  // z.coerce.boolean() coerces ANY truthy string (including "false") to true.
  // Use an explicit enum so the URL ?success=false actually maps to false.
  success: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const adminReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
