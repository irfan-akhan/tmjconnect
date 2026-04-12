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
  urgency: z.enum(['routine', 'concerning', 'urgent']).optional(),
  status: z.enum(['submitted', 'viewed', 'reviewed', 'responded']).optional(),
  unanswered_over_hours: z.coerce.number().int().min(1).optional(),
});

// ─── TODO #1: Notification outbox monitor ─────────────────────────────────────

export const outboxListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.enum(['email', 'sms', 'push']).optional(),
});

// ─── TODO #2: Active sessions panel ───────────────────────────────────────────

export const activeSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  role: z.enum(['patient', 'provider', 'admin']).optional(),
});

// ─── TODO #3: Job runner health ───────────────────────────────────────────────

export const jobHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── TODO #5: Provider performance ────────────────────────────────────────────

export const providerPerformanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['avg_response_hours', 'patient_count', 'response_rate', 'last_login_at']).default('avg_response_hours'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ─── TODO #6: Patient engagement ──────────────────────────────────────────────

export const patientEngagementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tier: z.enum(['highly_active', 'occasional', 'dormant', 'never_active']).optional(),
});

// ─── TODO #7: Security operations ─────────────────────────────────────────────

export const securitySummaryQuerySchema = z.object({
  window: z.enum(['1h', '6h', '12h', '24h', '7d']).default('24h'),
});

// ─── TODO #8: Linking summary ─────────────────────────────────────────────────

export const linkingCodesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'connected', 'expired']).optional(),
});

export const linkingLinksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'disconnected']).optional(),
});

// ─── TODO #9: PHI access reports ──────────────────────────────────────────────

export const phiAccessByActorQuerySchema = z.object({
  user_id: z.string().uuid(),
  from: z.string().date(),
  to: z.string().date(),
});

export const phiAccessByResourceQuerySchema = z.object({
  resource_type: z.string().max(50),
  resource_id: z.string().uuid(),
  from: z.string().date(),
  to: z.string().date(),
});

export const phiAnomaliesQuerySchema = z.object({
  window: z.enum(['1h', '6h', '12h', '24h']).default('24h'),
});

// ─── TODO #11: Global search ──────────────────────────────────────────────────

export const adminSearchQuerySchema = z.object({
  q: z.string().min(2).max(255),
  types: z.string().optional(), // comma-separated: 'user,report,audit_log'
});

// ─── TODO #12: Broadcasts ─────────────────────────────────────────────────────

export const createBroadcastSchema = z.object({
  audience: z.enum(['all', 'patients', 'providers', 'admins']),
  type: z.enum(['system', 'announcement']),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(2000),
  channels: z.array(z.enum(['in_app', 'email'])).min(1),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export const broadcastsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── TODO #14: Scheduled exports ──────────────────────────────────────────────

export const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(200),
  entity: z.enum(['audit_logs', 'login_events', 'users', 'reports']),
  filters: z.record(z.unknown()),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  recipient_emails: z.array(z.string().email()).min(1).max(10),
});

export const updateScheduledReportSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  filters: z.record(z.unknown()).optional(),
  cadence: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recipient_emails: z.array(z.string().email()).min(1).max(10).optional(),
  enabled: z.boolean().optional(),
});

export const scheduledReportsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── TODO #15: Feature flags ──────────────────────────────────────────────────

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Lowercase alphanumeric + underscores only'),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(false),
  rollout_percent: z.number().int().min(0).max(100).default(0),
  target_roles: z.array(z.enum(['patient', 'provider', 'admin'])).optional(),
});

export const updateFeatureFlagSchema = z.object({
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  rollout_percent: z.number().int().min(0).max(100).optional(),
  target_roles: z.array(z.enum(['patient', 'provider', 'admin'])).optional(),
});
