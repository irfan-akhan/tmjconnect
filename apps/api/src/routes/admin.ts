import { Router } from 'express';
import { z } from 'zod';
import type { Container } from '../config/container';
import { authenticate, authorize, checkSessionTimeout } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { parseListQuery } from '../utils/listHelpers';
import {
  adminUserListQuerySchema,
  adminUpdateUserSchema,
  auditLogQuerySchema,
  auditLogExportQuerySchema,
  loginEventQuerySchema,
  adminReportsQuerySchema,
  adminOutboxQuerySchema,
  adminSessionsQuerySchema,
  adminJobHistoryQuerySchema,
} from '@tmjconnect/shared';
import * as GetStats from '../use-cases/admin/get-stats';
import * as ListUsers from '../use-cases/admin/list-users';
import * as GetUser from '../use-cases/admin/get-user';
import * as UpdateUser from '../use-cases/admin/update-user';
import * as ListAuditLogs from '../use-cases/admin/list-audit-logs';
import * as ExportAuditLogs from '../use-cases/admin/export-audit-logs';
import * as ListLoginEvents from '../use-cases/admin/list-login-events';
import * as ListAllReports from '../use-cases/admin/list-all-reports';
import * as GetOutboxStats from '../use-cases/admin/get-outbox-stats';
import * as ListOutboxDlq from '../use-cases/admin/list-outbox-dlq';
import * as ListOutboxPending from '../use-cases/admin/list-outbox-pending';
import * as ListOutboxRecent from '../use-cases/admin/list-outbox-recent';
import * as ListActiveSessions from '../use-cases/admin/list-active-sessions';
import * as GetJobSummaries from '../use-cases/admin/get-job-summaries';
import * as ListJobHistory from '../use-cases/admin/list-job-history';
import * as GetPlatformAnalytics from '../use-cases/admin/get-platform-analytics';
import { runJobNow } from '../jobs';
import { retryOutboxEntry, dropOutboxEntry, deleteSession } from '../db/queries/admin.queries';
import {
  adminGlobalSearch,
  countAdminLinkingCodes,
  countAdminLinks,
  countBroadcasts,
  countPatientsByTier,
  countProviders,
  countScheduledReports,
  createBroadcast,
  createFeatureFlag,
  createScheduledReport,
  deleteFeatureFlag,
  deleteScheduledReport,
  getLinkingSummary,
  getNotificationPreferencesSummary,
  getPatientEngagement,
  getPatientEngagementSummary,
  getPhiAccessByActor,
  getPhiAccessByResource,
  getPhiAnomalies,
  getProviderPerformance,
  getSecuritySummary,
  listAdminLinkingCodes,
  listAdminLinks,
  listBroadcasts,
  listFeatureFlags,
  listScheduledReports,
  updateFeatureFlag,
  updateScheduledReport,
} from '../db/queries/admin-p1p2.queries';
import { dispatchBroadcast } from '../services/broadcastDispatch';

const createBroadcastSchema = z.object({
  audience: z.enum(['all', 'patients', 'providers', 'admins']),
  type: z.enum(['announcement', 'system']),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(2000),
  channels: z.array(z.enum(['in_app', 'email'])).min(1),
  scheduled_at: z.string().datetime().nullable().optional(),
});

const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(200),
  entity: z.string().min(1).max(50),
  filters: z.record(z.unknown()).default({}),
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  recipient_emails: z.array(z.string().email()).min(1),
});

const updateScheduledReportSchema = createScheduledReportSchema.partial().extend({
  enabled: z.boolean().optional(),
});

const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  enabled: z.boolean().default(false),
  description: z.string().max(500).optional(),
  rollout_percent: z.number().min(0).max(100).default(0),
  target_roles: z.array(z.enum(['patient', 'provider', 'admin'])).nullable().optional(),
});

const updateFeatureFlagSchema = createFeatureFlagSchema.partial();

function parseAdminPage(query: Record<string, unknown>, fallbackLimit = 20) {
  const parsedLimit = Number.parseInt(String(query.limit ?? fallbackLimit), 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : fallbackLimit;
  const parsedPage = Number.parseInt(String(query.page ?? '1'), 10);
  const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
  const parsedOffset = Number.parseInt(String(query.offset ?? ''), 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : (page - 1) * limit;
  return { limit, offset, page: Math.floor(offset / limit) + 1 };
}

function buildAdminPageMeta(total: number, limit: number, offset: number) {
  return {
    page: Math.floor(offset / limit) + 1,
    limit,
    offset,
    total,
    hasMore: offset + limit < total,
  };
}

function defaultDateRange(query: Record<string, unknown>) {
  const to = typeof query.to === 'string' ? query.to : new Date().toISOString();
  const from = typeof query.from === 'string'
    ? query.from
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export function adminRouter(container: Container) {
  const router = Router();
  // Admin sessions enforce the same 15-minute inactivity timeout as providers
  // (HIPAA — Section 8.2). Stale sessions are deleted and return 401 SESSION_TIMEOUT.
  router.use(authenticate, authorize('admin'), checkSessionTimeout(container.db));

  // ─── Dashboard stats ─────────────────────────────────────────────────────────
  router.get('/stats', async (_req, res, next) => {
    try {
      res.json({ data: await GetStats.execute(container) });
    } catch (err) { next(err); }
  });

  router.get('/analytics', auditLog('admin_viewed_analytics', 'user'), async (req, res, next) => {
    try {
      const parsedDays = Number.parseInt(String(req.query.days ?? '30'), 10);
      const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 365) : 30;
      res.json({ data: await GetPlatformAnalytics.execute(container, { days }) });
    } catch (err) { next(err); }
  });

  // ─── User management ─────────────────────────────────────────────────────────
  router.get('/users', validate(adminUserListQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { search, role, is_active, from, to } = req.query as unknown as Omit<ListUsers.ListUsersInput, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>;
      const result = await ListUsers.execute(container, { limit, offset, sortBy: sortBy as ListUsers.ListUsersInput['sortBy'], sortOrder, search, role, is_active, from, to });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  router.get('/users/:id', async (req, res, next) => {
    try {
      res.json({ data: await GetUser.execute(container, { userId: req.params.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/users/:id', validate(adminUpdateUserSchema), auditLog('admin_user_updated', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateUser.execute(container, { userId: req.params.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  // ─── Audit logs ──────────────────────────────────────────────────────────────
  router.get('/audit-logs', validate(auditLogQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { user_id, action, resource_type, from, to } = req.query as unknown as Omit<ListAuditLogs.ListAuditLogsInput, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>;
      const result = await ListAuditLogs.execute(container, { limit, offset, sortBy: sortBy as ListAuditLogs.ListAuditLogsInput['sortBy'], sortOrder, user_id, action, resource_type, from, to });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  // CSV export — streamed response. Audited because bulk PHI export is a HIPAA-sensitive action.
  router.get('/audit-logs/export', validate(auditLogExportQuerySchema, 'query'), auditLog('admin_audit_export', 'audit_log'), async (req, res, next) => {
    try {
      const { from, to } = req.query as unknown as { from: string; to: string };
      const rows = await ExportAuditLogs.execute(container, { from, to });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${from}-to-${to}.csv"`);

      // CSV header.
      res.write('id,user_id,action,resource_type,resource_id,ip_address,user_agent,metadata,created_at\n');

      // CSV rows.
      for (const row of rows as Record<string, unknown>[]) {
        const fields = [
          row.id,
          row.user_id ?? '',
          row.action,
          row.resource_type ?? '',
          row.resource_id ?? '',
          row.ip_address ?? '',
          `"${String(row.user_agent ?? '').replace(/"/g, '""')}"`,
          `"${JSON.stringify(row.metadata ?? {}).replace(/"/g, '""')}"`,
          row.created_at,
        ];
        res.write(fields.join(',') + '\n');
      }

      res.end();
    } catch (err) { next(err); }
  });

  // ─── Login events ────────────────────────────────────────────────────────────
  router.get('/login-events', validate(loginEventQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { user_id, success, from, to } = req.query as unknown as Omit<ListLoginEvents.ListLoginEventsInput, 'limit' | 'offset' | 'sortBy' | 'sortOrder'>;
      const result = await ListLoginEvents.execute(container, { limit, offset, sortBy: sortBy as ListLoginEvents.ListLoginEventsInput['sortBy'], sortOrder, user_id, success, from, to });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  // ─── All reports (cross-provider) ────────────────────────────────────────────
  router.get('/reports', validate(adminReportsQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const result = await ListAllReports.execute(container, { limit, offset, sortBy: sortBy as ListAllReports.ListAllReportsInput['sortBy'], sortOrder });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  // ─── Provider performance ───────────────────────────────────────────────────
  router.get('/providers/performance', async (req, res, next) => {
    try {
      const { limit, offset } = parseAdminPage(req.query as Record<string, unknown>);
      const sort = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'avg_response_hours';
      const order = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
      const [items, total] = await Promise.all([
        getProviderPerformance(container.db, limit, offset, sort, order),
        countProviders(container.db),
      ]);
      res.json({ data: items, meta: buildAdminPageMeta(total, limit, offset) });
    } catch (err) { next(err); }
  });

  // ─── Patient engagement ─────────────────────────────────────────────────────
  router.get('/patients/engagement', async (req, res, next) => {
    try {
      const { limit, offset } = parseAdminPage(req.query as Record<string, unknown>);
      const tier = typeof req.query.tier === 'string' ? req.query.tier : undefined;
      const [items, total, summary] = await Promise.all([
        getPatientEngagement(container.db, limit, offset, tier),
        countPatientsByTier(container.db, tier),
        getPatientEngagementSummary(container.db),
      ]);
      res.json({ data: items, meta: buildAdminPageMeta(total, limit, offset), summary });
    } catch (err) { next(err); }
  });

  // ─── Security operations ────────────────────────────────────────────────────
  router.get('/security/summary', async (req, res, next) => {
    try {
      const window = typeof req.query.window === 'string' ? req.query.window : '24h';
      res.json({ data: await getSecuritySummary(container.db, window) });
    } catch (err) { next(err); }
  });

  // ─── Linking admin views ────────────────────────────────────────────────────
  router.get('/linking/summary', async (_req, res, next) => {
    try {
      res.json({ data: await getLinkingSummary(container.db) });
    } catch (err) { next(err); }
  });

  router.get('/linking/codes', async (req, res, next) => {
    try {
      const { limit, offset } = parseAdminPage(req.query as Record<string, unknown>);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const [items, total] = await Promise.all([
        listAdminLinkingCodes(container.db, limit, offset, status),
        countAdminLinkingCodes(container.db, status),
      ]);
      res.json({ data: items, meta: buildAdminPageMeta(total, limit, offset) });
    } catch (err) { next(err); }
  });

  router.get('/linking/links', async (req, res, next) => {
    try {
      const { limit, offset } = parseAdminPage(req.query as Record<string, unknown>);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const [items, total] = await Promise.all([
        listAdminLinks(container.db, limit, offset, status),
        countAdminLinks(container.db, status),
      ]);
      res.json({ data: items, meta: buildAdminPageMeta(total, limit, offset) });
    } catch (err) { next(err); }
  });

  // ─── PHI access reports ─────────────────────────────────────────────────────
  router.get('/phi-access/by-actor', async (req, res, next) => {
    try {
      if (typeof req.query.user_id !== 'string') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'user_id is required' } });
      const { from, to } = defaultDateRange(req.query as Record<string, unknown>);
      res.json({ data: await getPhiAccessByActor(container.db, req.query.user_id, from, to) });
    } catch (err) { next(err); }
  });

  router.get('/phi-access/by-resource', async (req, res, next) => {
    try {
      if (typeof req.query.resource_type !== 'string' || typeof req.query.resource_id !== 'string') {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'resource_type and resource_id are required' } });
      }
      const { from, to } = defaultDateRange(req.query as Record<string, unknown>);
      res.json({ data: await getPhiAccessByResource(container.db, req.query.resource_type, req.query.resource_id, from, to) });
    } catch (err) { next(err); }
  });

  router.get('/phi-access/anomalies', async (req, res, next) => {
    try {
      const window = typeof req.query.window === 'string' ? req.query.window : '24h';
      res.json({ data: await getPhiAnomalies(container.db, window) });
    } catch (err) { next(err); }
  });

  // ─── Notification preferences audit ─────────────────────────────────────────
  router.get('/notifications/preferences-summary', async (_req, res, next) => {
    try {
      res.json({ data: await getNotificationPreferencesSummary(container.db) });
    } catch (err) { next(err); }
  });

  // ─── Global search ──────────────────────────────────────────────────────────
  router.get('/search', async (req, res, next) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2) return res.json({ data: {} });
      const types = typeof req.query.types === 'string'
        ? req.query.types.split(',').map((type) => type.trim()).filter(Boolean)
        : ['user', 'report', 'audit_log'];
      res.json({ data: await adminGlobalSearch(container.db, q, types) });
    } catch (err) { next(err); }
  });

  // ─── Notification outbox monitor ────────────────────────────────────────────
  router.get('/outbox/stats', async (_req, res, next) => {
    try {
      res.json({ data: await GetOutboxStats.execute(container) });
    } catch (err) { next(err); }
  });

  router.get('/outbox/dlq', validate(adminOutboxQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { channel } = req.query as unknown as Pick<ListOutboxDlq.Input, 'channel'>;
      const result = await ListOutboxDlq.execute(container, { limit, offset, sortBy: sortBy as ListOutboxDlq.Input['sortBy'], sortOrder, channel });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  router.get('/outbox/pending', validate(adminOutboxQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { channel } = req.query as unknown as Pick<ListOutboxPending.Input, 'channel'>;
      const result = await ListOutboxPending.execute(container, { limit, offset, sortBy: sortBy as ListOutboxPending.Input['sortBy'], sortOrder, channel });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  router.get('/outbox/recent', validate(adminOutboxQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { channel } = req.query as unknown as Pick<ListOutboxRecent.Input, 'channel'>;
      const result = await ListOutboxRecent.execute(container, { limit, offset, sortBy: sortBy as ListOutboxRecent.Input['sortBy'], sortOrder, channel });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  router.post('/outbox/:id/retry', auditLog('admin_outbox_retried', 'notification_outbox'), async (req, res, next) => {
    try {
      const success = await retryOutboxEntry(container.db, req.params.id);
      if (!success) return res.status(404).json({ error: 'Entry not found or already sent' });
      res.json({ data: { id: req.params.id, retried: true } });
    } catch (err) { next(err); }
  });

  router.delete('/outbox/:id', auditLog('admin_outbox_dropped', 'notification_outbox'), async (req, res, next) => {
    try {
      const success = await dropOutboxEntry(container.db, req.params.id);
      if (!success) return res.status(404).json({ error: 'Entry not found or already sent' });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Broadcasts ─────────────────────────────────────────────────────────────
  router.get('/broadcasts', async (req, res, next) => {
    try {
      const parsedLimit = Number.parseInt(String(req.query.limit ?? '20'), 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;
      const parsedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
      const page = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
      const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
      const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : (page - 1) * limit;
      const [items, total] = await Promise.all([
        listBroadcasts(container.db, limit, offset),
        countBroadcasts(container.db),
      ]);

      res.json({
        data: items,
        meta: {
          page: Math.floor(offset / limit) + 1,
          limit,
          offset,
          total,
          hasMore: offset + items.length < total,
        },
      });
    } catch (err) { next(err); }
  });

  router.post('/broadcasts', validate(createBroadcastSchema), auditLog('admin_broadcast_sent', 'broadcast'), async (req, res, next) => {
    try {
      const broadcast = await createBroadcast(container.db, {
        created_by: req.user!.id,
        audience: req.body.audience,
        type: req.body.type,
        title: req.body.title,
        body: req.body.body,
        channels: req.body.channels,
        scheduled_at: req.body.scheduled_at ?? null,
      });

      const delivery = req.body.scheduled_at ? { emailSent: 0, emailFailed: 0, inAppSent: 0 } : await dispatchBroadcast(container, {
        id: broadcast?.id ?? 'immediate',
        audience: req.body.audience,
        type: req.body.type,
        title: req.body.title,
        body: req.body.body,
        channels: req.body.channels,
      });

      res.status(201).json({
        data: {
          broadcast_id: broadcast?.id,
          recipient_count: broadcast?.recipient_count ?? 0,
          in_app_sent: delivery.inAppSent,
          email_sent: delivery.emailSent,
          email_failed: delivery.emailFailed,
        },
      });
    } catch (err) { next(err); }
  });

  // ─── System metrics ─────────────────────────────────────────────────────────
  router.get('/system/metrics', async (_req, res, next) => {
    try {
      res.json({
        data: {
          uptime_seconds: Math.round(process.uptime()),
          memory: process.memoryUsage(),
          node_version: process.version,
          env: container.env.NODE_ENV,
          db_pool: {
            total: container.pool.totalCount,
            idle: container.pool.idleCount,
            waiting: container.pool.waitingCount,
          },
        },
      });
    } catch (err) { next(err); }
  });

  // ─── Scheduled reports ──────────────────────────────────────────────────────
  router.get('/scheduled-reports', async (req, res, next) => {
    try {
      const { limit, offset } = parseAdminPage(req.query as Record<string, unknown>);
      const [items, total] = await Promise.all([
        listScheduledReports(container.db, limit, offset),
        countScheduledReports(container.db),
      ]);
      res.json({ data: items, meta: buildAdminPageMeta(total, limit, offset) });
    } catch (err) { next(err); }
  });

  router.post('/scheduled-reports', validate(createScheduledReportSchema), auditLog('admin_scheduled_report_created', 'scheduled_report'), async (req, res, next) => {
    try {
      const report = await createScheduledReport(container.db, { ...req.body, created_by: req.user!.id });
      res.status(201).json({ data: report });
    } catch (err) { next(err); }
  });

  router.patch('/scheduled-reports/:id', validate(updateScheduledReportSchema), auditLog('admin_scheduled_report_updated', 'scheduled_report'), async (req, res, next) => {
    try {
      const report = await updateScheduledReport(container.db, req.params.id, req.body);
      if (!report) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scheduled report not found or no fields provided' } });
      res.json({ data: report });
    } catch (err) { next(err); }
  });

  router.delete('/scheduled-reports/:id', auditLog('admin_scheduled_report_deleted', 'scheduled_report'), async (req, res, next) => {
    try {
      const deleted = await deleteScheduledReport(container.db, req.params.id);
      if (!deleted) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Scheduled report not found' } });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Feature flags ──────────────────────────────────────────────────────────
  router.get('/feature-flags', async (_req, res, next) => {
    try {
      res.json({ data: await listFeatureFlags(container.db) });
    } catch (err) { next(err); }
  });

  router.post('/feature-flags', validate(createFeatureFlagSchema), auditLog('admin_feature_flag_created', 'feature_flag'), async (req, res, next) => {
    try {
      const flag = await createFeatureFlag(container.db, { ...req.body, target_roles: req.body.target_roles ?? undefined, updated_by: req.user!.id });
      res.status(201).json({ data: flag });
    } catch (err) { next(err); }
  });

  router.patch('/feature-flags/:key', validate(updateFeatureFlagSchema), auditLog('admin_feature_flag_updated', 'feature_flag'), async (req, res, next) => {
    try {
      const flag = await updateFeatureFlag(container.db, req.params.key, { ...req.body, target_roles: req.body.target_roles ?? undefined, updated_by: req.user!.id });
      if (!flag) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feature flag not found' } });
      res.json({ data: flag });
    } catch (err) { next(err); }
  });

  router.delete('/feature-flags/:key', auditLog('admin_feature_flag_deleted', 'feature_flag'), async (req, res, next) => {
    try {
      const deleted = await deleteFeatureFlag(container.db, req.params.key);
      if (!deleted) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Feature flag not found' } });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Active sessions ─────────────────────────────────────────────────────────
  router.get('/sessions/active', validate(adminSessionsQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { role } = req.query as unknown as Pick<ListActiveSessions.Input, 'role'>;
      const result = await ListActiveSessions.execute(container, { limit, offset, sortBy: sortBy as ListActiveSessions.Input['sortBy'], sortOrder, role });
      res.json({ data: result.items, meta: result.meta, summary: result.summary });
    } catch (err) { next(err); }
  });

  router.delete('/sessions/:id', auditLog('admin_session_revoked', 'session'), async (req, res, next) => {
    try {
      const success = await deleteSession(container.db, req.params.id);
      if (!success) return res.status(404).json({ error: 'Session not found' });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ─── Job runner health ───────────────────────────────────────────────────────
  router.get('/jobs', async (_req, res, next) => {
    try {
      res.json({ data: await GetJobSummaries.execute(container) });
    } catch (err) { next(err); }
  });

  router.post('/jobs/:jobName/run', auditLog('admin_job_triggered', 'job_run'), async (req, res, next) => {
    try {
      const accepted = await runJobNow(container, req.params.jobName);
      if (!accepted) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
      res.status(202).json({ data: { job_name: req.params.jobName, triggered: true } });
    } catch (err) { next(err); }
  });

  router.get('/jobs/:jobName/history', validate(adminJobHistoryQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const result = await ListJobHistory.execute(container, { jobName: req.params.jobName, limit, offset, sortBy: sortBy as ListJobHistory.Input['sortBy'], sortOrder });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  return router;
}
