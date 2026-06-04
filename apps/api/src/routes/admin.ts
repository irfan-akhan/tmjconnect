import { Router } from 'express';
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
import * as ListActiveSessions from '../use-cases/admin/list-active-sessions';
import * as GetJobSummaries from '../use-cases/admin/get-job-summaries';
import * as ListJobHistory from '../use-cases/admin/list-job-history';
import * as GetPlatformAnalytics from '../use-cases/admin/get-platform-analytics';
import { retryOutboxEntry, dropOutboxEntry, deleteSession } from '../db/queries/admin.queries';

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

  router.get('/jobs/:jobName/history', validate(adminJobHistoryQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const result = await ListJobHistory.execute(container, { jobName: req.params.jobName, limit, offset, sortBy: sortBy as ListJobHistory.Input['sortBy'], sortOrder });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  return router;
}
