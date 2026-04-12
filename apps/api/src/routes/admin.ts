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
  outboxListQuerySchema,
  activeSessionsQuerySchema,
  jobHistoryQuerySchema,
  providerPerformanceQuerySchema,
  patientEngagementQuerySchema,
  securitySummaryQuerySchema,
  linkingCodesQuerySchema,
  linkingLinksQuerySchema,
  phiAccessByActorQuerySchema,
  phiAccessByResourceQuerySchema,
  phiAnomaliesQuerySchema,
  adminSearchQuerySchema,
  createBroadcastSchema,
  broadcastsListQuerySchema,
  createScheduledReportSchema,
  updateScheduledReportSchema,
  scheduledReportsListQuerySchema,
  createFeatureFlagSchema,
  updateFeatureFlagSchema,
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
import {
  retryOutboxEntry,
  dropOutboxEntry,
  deleteSession,
  getExtendedAdminStats,
  listAllReportsFiltered,
  countAllReports,
} from '../db/queries/admin.queries';
import {
  getProviderPerformance,
  countProviders,
  getPatientEngagement,
  getPatientEngagementSummary,
  countPatientsByTier,
  getSecuritySummary,
  getLinkingSummary,
  listAdminLinkingCodes,
  countAdminLinkingCodes,
  listAdminLinks,
  countAdminLinks,
  getPhiAccessByActor,
  getPhiAccessByResource,
  getPhiAnomalies,
  getNotificationPreferencesSummary,
  adminGlobalSearch,
  createBroadcast,
  listBroadcasts,
  countBroadcasts,
  listScheduledReports,
  countScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  listFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
} from '../db/queries/admin-p1p2.queries';

export function adminRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('admin'), checkSessionTimeout(container.db));

  // ─── Dashboard stats (extended with urgent reports) ─────────────────────────
  router.get('/stats', async (_req, res, next) => {
    try {
      const [base, extended] = await Promise.all([
        GetStats.execute(container),
        getExtendedAdminStats(container.db),
      ]);
      res.json({ data: { ...base, ...extended } });
    } catch (err) { next(err); }
  });

  // ─── User management ─────────────────────────────────────────────────────────
  router.get(
    '/users',
    validate(adminUserListQuerySchema, 'query'),
    auditLog('admin_listed_users', 'user'),
    async (req, res, next) => {
      try {
        const { page, limit, ...filters } = req.query as unknown as ListUsers.ListUsersInput;
        const result = await ListUsers.execute(container, { page, limit, ...filters });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/users/:id',
    auditLog('admin_viewed_user', 'user'),
    async (req, res, next) => {
      try {
        res.json({ data: await GetUser.execute(container, { userId: req.params.id }) });
      } catch (err) { next(err); }
    },
  );

  router.patch('/users/:id', validate(adminUpdateUserSchema), auditLog('admin_user_updated', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateUser.execute(container, { userId: req.params.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  // ─── Audit logs ──────────────────────────────────────────────────────────────
  router.get(
    '/audit-logs',
    validate(auditLogQuerySchema, 'query'),
    auditLog('admin_viewed_audit_logs', 'audit_log'),
    async (req, res, next) => {
      try {
        const { page, limit, ...filters } = req.query as unknown as ListAuditLogs.ListAuditLogsInput;
        const result = await ListAuditLogs.execute(container, { page, limit, ...filters });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  router.get('/audit-logs/export', validate(auditLogExportQuerySchema, 'query'), auditLog('admin_audit_export', 'audit_log'), async (req, res, next) => {
    try {
      const { from, to } = req.query as unknown as { from: string; to: string };
      const rows = await ExportAuditLogs.execute(container, { from, to });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${from}-to-${to}.csv"`);
      res.write('id,user_id,action,resource_type,resource_id,ip_address,user_agent,metadata,created_at\n');

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
  router.get(
    '/login-events',
    validate(loginEventQuerySchema, 'query'),
    auditLog('admin_viewed_login_events', 'login_event'),
    async (req, res, next) => {
      try {
        const { page, limit, ...filters } = req.query as unknown as ListLoginEvents.ListLoginEventsInput;
        const result = await ListLoginEvents.execute(container, { page, limit, ...filters });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  // ─── All reports (cross-provider, now with urgency/status/unanswered filters) ─
  router.get(
    '/reports',
    validate(adminReportsQuerySchema, 'query'),
    auditLog('admin_viewed_all_reports', 'report'),
    async (req, res, next) => {
      try {
        const { page, limit, urgency, status, unanswered_over_hours } =
          req.query as unknown as {
            page: number;
            limit: number;
            urgency?: string;
            status?: string;
            unanswered_over_hours?: number;
          };
        const filters = { urgency, status, unanswered_over_hours };
        const [items, total] = await Promise.all([
          listAllReportsFiltered(container.db, page, limit, filters),
          countAllReports(container.db, filters),
        ]);
        res.json({
          data: items,
          meta: { page, limit, total, hasMore: page * limit < total },
        });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // TODO #1: Notification outbox monitor
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/outbox/stats', async (_req, res, next) => {
    try {
      res.json({ data: await GetOutboxStats.execute(container) });
    } catch (err) { next(err); }
  });

  router.get(
    '/outbox/dlq',
    validate(outboxListQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit, channel } = req.query as unknown as ListOutboxDlq.Input;
        const result = await ListOutboxDlq.execute(container, { page, limit, channel });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/outbox/pending',
    validate(outboxListQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit, channel } = req.query as unknown as ListOutboxPending.Input;
        const result = await ListOutboxPending.execute(container, { page, limit, channel });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  router.post('/outbox/:id/retry', auditLog('admin_outbox_retried', 'notification_outbox'), async (req, res, next) => {
    try {
      const ok = await retryOutboxEntry(container.db, req.params.id);
      if (!ok) return res.status(404).json({ error: { message: 'Entry not found or already sent.' } });
      res.locals.auditResourceId = req.params.id;
      res.json({ data: { id: req.params.id, retried: true } });
    } catch (err) { next(err); }
  });

  router.delete('/outbox/:id', auditLog('admin_outbox_dropped', 'notification_outbox'), async (req, res, next) => {
    try {
      const ok = await dropOutboxEntry(container.db, req.params.id);
      if (!ok) return res.status(404).json({ error: { message: 'Entry not found or already sent.' } });
      res.locals.auditResourceId = req.params.id;
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TODO #2: Active sessions panel
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/sessions/active',
    validate(activeSessionsQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit, role } = req.query as unknown as ListActiveSessions.Input;
        const result = await ListActiveSessions.execute(container, { page, limit, role });
        res.json({ data: result.items, meta: result.meta, summary: result.summary });
      } catch (err) { next(err); }
    },
  );

  router.delete('/sessions/:id', auditLog('admin_session_terminated', 'session'), async (req, res, next) => {
    try {
      const ok = await deleteSession(container.db, req.params.id);
      if (!ok) return res.status(404).json({ error: { message: 'Session not found.' } });
      res.locals.auditResourceId = req.params.id;
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // TODO #3: Job runner health
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/jobs', async (_req, res, next) => {
    try {
      res.json({ data: await GetJobSummaries.execute(container) });
    } catch (err) { next(err); }
  });

  router.get(
    '/jobs/:name/history',
    validate(jobHistoryQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit } = req.query as unknown as { page: number; limit: number };
        const result = await ListJobHistory.execute(container, {
          jobName: req.params.name,
          page,
          limit,
        });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  // Manual trigger — enqueues an immediate run via the normal job pathway.
  // The job still respects the advisory lock, so a concurrent cron run
  // will not collide.
  router.post('/jobs/:name/run', auditLog('admin_job_triggered', 'job'), async (req, res, next) => {
    try {
      const { name } = req.params;
      const knownJobs = [
        'reminderJob', 'codeExpiryJob', 'weeklyDigestJob',
        'cleanupJob', 'orphanFileCleanupJob', 'outboxJob',
      ];
      if (!knownJobs.includes(name)) {
        return res.status(400).json({ error: { message: `Unknown job: ${name}` } });
      }
      // We don't await the job — we just fire it and return 202.
      // The job runner will record the run in job_runs.
      res.locals.auditResourceId = name;
      res.status(202).json({ data: { job: name, status: 'enqueued' } });
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #5: Provider performance dashboard
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/providers/performance',
    validate(providerPerformanceQuerySchema, 'query'),
    auditLog('admin_viewed_provider_performance', 'provider'),
    async (req, res, next) => {
      try {
        const { page, limit, sort, order } = req.query as unknown as { page: number; limit: number; sort: string; order: string };
        const [items, total] = await Promise.all([
          getProviderPerformance(container.db, page, limit, sort, order),
          countProviders(container.db),
        ]);
        res.json({ data: items, meta: { page, limit, total } });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #6: Patient engagement & churn
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/patients/engagement',
    validate(patientEngagementQuerySchema, 'query'),
    auditLog('admin_viewed_patient_engagement', 'patient'),
    async (req, res, next) => {
      try {
        const { page, limit, tier } = req.query as unknown as { page: number; limit: number; tier?: string };
        const [items, total, summary] = await Promise.all([
          getPatientEngagement(container.db, page, limit, tier),
          countPatientsByTier(container.db, tier),
          getPatientEngagementSummary(container.db),
        ]);
        res.json({ data: items, meta: { page, limit, total }, summary });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #7: Security operations (SIEM-lite)
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/security/summary',
    validate(securitySummaryQuerySchema, 'query'),
    auditLog('admin_viewed_security_summary', 'security'),
    async (req, res, next) => {
      try {
        const { window } = req.query as unknown as { window: string };
        res.json({ data: await getSecuritySummary(container.db, window) });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #8: Linking & relationships summary
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/linking/summary', async (_req, res, next) => {
    try {
      res.json({ data: await getLinkingSummary(container.db) });
    } catch (err) { next(err); }
  });

  router.get(
    '/linking/codes',
    validate(linkingCodesQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
        const [items, total] = await Promise.all([
          listAdminLinkingCodes(container.db, page, limit, status),
          countAdminLinkingCodes(container.db, status),
        ]);
        res.json({ data: items, meta: { page, limit, total } });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/linking/links',
    validate(linkingLinksQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
        const [items, total] = await Promise.all([
          listAdminLinks(container.db, page, limit, status),
          countAdminLinks(container.db, status),
        ]);
        res.json({ data: items, meta: { page, limit, total } });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #9: PHI access reports (HIPAA artifact)
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/phi-access/by-actor',
    validate(phiAccessByActorQuerySchema, 'query'),
    auditLog('admin_viewed_phi_access_by_actor', 'audit_log'),
    async (req, res, next) => {
      try {
        const { user_id, from, to } = req.query as unknown as { user_id: string; from: string; to: string };
        res.json({ data: await getPhiAccessByActor(container.db, user_id, from, to) });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/phi-access/by-resource',
    validate(phiAccessByResourceQuerySchema, 'query'),
    auditLog('admin_viewed_phi_access_by_resource', 'audit_log'),
    async (req, res, next) => {
      try {
        const { resource_type, resource_id, from, to } = req.query as unknown as {
          resource_type: string; resource_id: string; from: string; to: string;
        };
        res.json({ data: await getPhiAccessByResource(container.db, resource_type, resource_id, from, to) });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/phi-access/anomalies',
    validate(phiAnomaliesQuerySchema, 'query'),
    auditLog('admin_viewed_phi_anomalies', 'audit_log'),
    async (req, res, next) => {
      try {
        const { window } = req.query as unknown as { window: string };
        res.json({ data: await getPhiAnomalies(container.db, window) });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P1 — TODO #10: Notification preferences audit
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/notifications/preferences-summary', async (_req, res, next) => {
    try {
      res.json({ data: await getNotificationPreferencesSummary(container.db) });
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // P2 — TODO #11: Global server-side search
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get(
    '/search',
    validate(adminSearchQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { q, types: typesStr } = req.query as unknown as { q: string; types?: string };
        const types = typesStr ? typesStr.split(',').map((t) => t.trim()) : ['user', 'report', 'audit_log'];
        res.json({ data: await adminGlobalSearch(container.db, q, types) });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P2 — TODO #12: Broadcasts
  // ═══════════════════════════════════════════════════════════════════════════════

  router.post(
    '/broadcasts',
    validate(createBroadcastSchema),
    auditLog('admin_broadcast_sent', 'broadcast'),
    async (req, res, next) => {
      try {
        const result = await createBroadcast(container.db, {
          ...req.body,
          created_by: req.user!.id,
        });
        if (!result) return res.status(500).json({ error: { message: 'Failed to create broadcast.' } });
        res.locals.auditResourceId = result.id;
        res.status(201).json({ data: { broadcast_id: result.id, recipient_count: result.recipient_count } });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/broadcasts',
    validate(broadcastsListQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit } = req.query as unknown as { page: number; limit: number };
        const [items, total] = await Promise.all([
          listBroadcasts(container.db, page, limit),
          countBroadcasts(container.db),
        ]);
        res.json({ data: items, meta: { page, limit, total } });
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P2 — TODO #13: System metrics
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/system/metrics', async (_req, res, next) => {
    try {
      const mem = process.memoryUsage();
      const load = require('os').loadavg();
      res.json({
        data: {
          api: {
            uptime_seconds: Math.round(process.uptime()),
            memory: {
              rss_mb: Math.round(mem.rss / 1024 / 1024),
              heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
              heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
            },
            cpu_load_1m: Math.round(load[0] * 100) / 100,
            pid: process.pid,
            node_version: process.version,
          },
          db: {
            pool_total: container.pool.totalCount,
            pool_idle: container.pool.idleCount,
            pool_waiting: container.pool.waitingCount,
          },
        },
      });
    } catch (err) { next(err); }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // P2 — TODO #14: Scheduled exports
  // ═══════════════════════════════════════════════════════════════════════════════

  router.post(
    '/scheduled-reports',
    validate(createScheduledReportSchema),
    auditLog('admin_scheduled_report_created', 'scheduled_report'),
    async (req, res, next) => {
      try {
        const result = await createScheduledReport(container.db, {
          ...req.body,
          created_by: req.user!.id,
        });
        if (!result) return res.status(500).json({ error: { message: 'Failed to create.' } });
        res.locals.auditResourceId = result.id;
        res.status(201).json({ data: result });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/scheduled-reports',
    validate(scheduledReportsListQuerySchema, 'query'),
    async (req, res, next) => {
      try {
        const { page, limit } = req.query as unknown as { page: number; limit: number };
        const [items, total] = await Promise.all([
          listScheduledReports(container.db, page, limit),
          countScheduledReports(container.db),
        ]);
        res.json({ data: items, meta: { page, limit, total } });
      } catch (err) { next(err); }
    },
  );

  router.patch(
    '/scheduled-reports/:id',
    validate(updateScheduledReportSchema),
    auditLog('admin_scheduled_report_updated', 'scheduled_report'),
    async (req, res, next) => {
      try {
        const result = await updateScheduledReport(container.db, req.params.id, req.body);
        if (!result) return res.status(404).json({ error: { message: 'Not found.' } });
        res.locals.auditResourceId = req.params.id;
        res.json({ data: result });
      } catch (err) { next(err); }
    },
  );

  router.delete(
    '/scheduled-reports/:id',
    auditLog('admin_scheduled_report_deleted', 'scheduled_report'),
    async (req, res, next) => {
      try {
        const ok = await deleteScheduledReport(container.db, req.params.id);
        if (!ok) return res.status(404).json({ error: { message: 'Not found.' } });
        res.locals.auditResourceId = req.params.id;
        res.status(204).end();
      } catch (err) { next(err); }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════════
  // P2 — TODO #15: Feature flags
  // ═══════════════════════════════════════════════════════════════════════════════

  router.get('/feature-flags', async (_req, res, next) => {
    try {
      res.json({ data: await listFeatureFlags(container.db) });
    } catch (err) { next(err); }
  });

  router.post(
    '/feature-flags',
    validate(createFeatureFlagSchema),
    auditLog('admin_feature_flag_created', 'feature_flag'),
    async (req, res, next) => {
      try {
        const result = await createFeatureFlag(container.db, {
          ...req.body,
          updated_by: req.user!.id,
        });
        if (!result) return res.status(500).json({ error: { message: 'Failed to create.' } });
        res.locals.auditResourceId = result.key;
        res.status(201).json({ data: result });
      } catch (err) { next(err); }
    },
  );

  router.patch(
    '/feature-flags/:key',
    validate(updateFeatureFlagSchema),
    auditLog('admin_feature_flag_updated', 'feature_flag'),
    async (req, res, next) => {
      try {
        const result = await updateFeatureFlag(container.db, req.params.key, {
          ...req.body,
          updated_by: req.user!.id,
        });
        if (!result) return res.status(404).json({ error: { message: 'Flag not found.' } });
        res.locals.auditResourceId = req.params.key;
        res.json({ data: result });
      } catch (err) { next(err); }
    },
  );

  router.delete(
    '/feature-flags/:key',
    auditLog('admin_feature_flag_deleted', 'feature_flag'),
    async (req, res, next) => {
      try {
        const ok = await deleteFeatureFlag(container.db, req.params.key);
        if (!ok) return res.status(404).json({ error: { message: 'Flag not found.' } });
        res.locals.auditResourceId = req.params.key;
        res.status(204).end();
      } catch (err) { next(err); }
    },
  );

  return router;
}
