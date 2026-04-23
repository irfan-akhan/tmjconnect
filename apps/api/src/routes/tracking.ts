import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  createMobilityLogSchema,
  createMedicationLogSchema,
  createSleepLogSchema,
  trackingListQuerySchema,
  trackingTrendQuerySchema,
} from '@tmjconnect/shared';
import { parseCursorPagination, buildCursorMeta } from '../utils/pagination';
import {
  createMobilityLog, listMobilityLogs, getMobilityTrend,
  createMedicationLog, listMedicationLogs, getMedicationCorrelation,
  createSleepLog, listSleepLogs, getSleepCorrelation,
} from '../db/queries/tracking.queries';

export function trackingRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  // ─── Jaw Mobility ───────────────────────────────────────────────────────

  router.post('/mobility', validate(createMobilityLogSchema), auditLog('mobility_logged', 'jaw_mobility_log'), async (req, res, next) => {
    try {
      const row = await createMobilityLog(container.db, req.user!, req.body);
      res.locals.auditResourceId = row.id;
      res.status(201).json({ data: row });
    } catch (err) { next(err); }
  });

  router.get('/mobility', validate(trackingListQuerySchema, 'query'), auditLog('mobility_list_viewed', 'jaw_mobility_log'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const rows = await listMobilityLogs(container.db, req.user!, cursor, limit);
      const meta = buildCursorMeta(rows, limit, 'logged_at');
      res.json({ data: rows.slice(0, limit), meta });
    } catch (err) { next(err); }
  });

  router.get('/mobility/trend', validate(trackingTrendQuerySchema, 'query'), auditLog('mobility_trend_viewed', 'jaw_mobility_log'), async (req, res, next) => {
    try {
      const days = (req.query as unknown as { days: number }).days;
      res.json({ data: await getMobilityTrend(container.db, req.user!.id, days) });
    } catch (err) { next(err); }
  });

  // ─── Medications ────────────────────────────────────────────────────────

  router.post('/medications', validate(createMedicationLogSchema), auditLog('medication_logged', 'medication_log'), async (req, res, next) => {
    try {
      const row = await createMedicationLog(container.db, req.user!, req.body);
      res.locals.auditResourceId = row.id;
      res.status(201).json({ data: row });
    } catch (err) { next(err); }
  });

  router.get('/medications', validate(trackingListQuerySchema, 'query'), auditLog('medication_list_viewed', 'medication_log'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const rows = await listMedicationLogs(container.db, req.user!, cursor, limit);
      const meta = buildCursorMeta(rows, limit, 'logged_at');
      res.json({ data: rows.slice(0, limit), meta });
    } catch (err) { next(err); }
  });

  router.get('/medications/correlation', validate(trackingTrendQuerySchema, 'query'), auditLog('medication_correlation_viewed', 'medication_log'), async (req, res, next) => {
    try {
      const days = (req.query as unknown as { days: number }).days;
      res.json({ data: await getMedicationCorrelation(container.db, req.user!.id, days) });
    } catch (err) { next(err); }
  });

  // ─── Sleep ──────────────────────────────────────────────────────────────

  router.post('/sleep', validate(createSleepLogSchema), auditLog('sleep_logged', 'sleep_log'), async (req, res, next) => {
    try {
      const row = await createSleepLog(container.db, req.user!, req.body);
      res.locals.auditResourceId = row.id;
      res.status(201).json({ data: row });
    } catch (err) { next(err); }
  });

  router.get('/sleep', validate(trackingListQuerySchema, 'query'), auditLog('sleep_list_viewed', 'sleep_log'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const rows = await listSleepLogs(container.db, req.user!, cursor, limit);
      const meta = buildCursorMeta(rows, limit, 'logged_at');
      res.json({ data: rows.slice(0, limit), meta });
    } catch (err) { next(err); }
  });

  router.get('/sleep/correlation', validate(trackingTrendQuerySchema, 'query'), auditLog('sleep_correlation_viewed', 'sleep_log'), async (req, res, next) => {
    try {
      const days = (req.query as unknown as { days: number }).days;
      res.json({ data: await getSleepCorrelation(container.db, req.user!.id, days) });
    } catch (err) { next(err); }
  });

  return router;
}
