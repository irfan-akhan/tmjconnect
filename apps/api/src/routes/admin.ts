import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize, checkSessionTimeout } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  adminUserListQuerySchema,
  adminUpdateUserSchema,
  auditLogQuerySchema,
  auditLogExportQuerySchema,
  loginEventQuerySchema,
  adminReportsQuerySchema,
} from '@tmjconnect/shared';
import * as GetStats from '../use-cases/admin/get-stats';
import * as ListUsers from '../use-cases/admin/list-users';
import * as GetUser from '../use-cases/admin/get-user';
import * as UpdateUser from '../use-cases/admin/update-user';
import * as ListAuditLogs from '../use-cases/admin/list-audit-logs';
import * as ExportAuditLogs from '../use-cases/admin/export-audit-logs';
import * as ListLoginEvents from '../use-cases/admin/list-login-events';
import * as ListAllReports from '../use-cases/admin/list-all-reports';

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

  // ─── User management ─────────────────────────────────────────────────────────
  router.get('/users', validate(adminUserListQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { page, limit, ...filters } = req.query as unknown as ListUsers.ListUsersInput;
      const result = await ListUsers.execute(container, { page, limit, ...filters });
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
      const { page, limit, ...filters } = req.query as unknown as ListAuditLogs.ListAuditLogsInput;
      const result = await ListAuditLogs.execute(container, { page, limit, ...filters });
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
      const { page, limit, ...filters } = req.query as unknown as ListLoginEvents.ListLoginEventsInput;
      const result = await ListLoginEvents.execute(container, { page, limit, ...filters });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  // ─── All reports (cross-provider) ────────────────────────────────────────────
  router.get('/reports', validate(adminReportsQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { page, limit } = req.query as unknown as { page: number; limit: number };
      const result = await ListAllReports.execute(container, { page, limit });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  return router;
}
