import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  createSymptomLogSchema,
  updateSymptomLogSchema,
  symptomListQuerySchema,
  symptomCalendarQuerySchema,
} from '@tmjconnect/shared';
import { parseCursorPagination, buildCursorMeta } from '../utils/pagination';
import * as UpsertLog from '../use-cases/symptoms/upsert-log';
import * as ListLogs from '../use-cases/symptoms/list-logs';
import * as GetCalendar from '../use-cases/symptoms/get-calendar';
import * as GetStats from '../use-cases/symptoms/get-stats';
import * as GetLog from '../use-cases/symptoms/get-log';
import * as UpdateLog from '../use-cases/symptoms/update-log';
import * as DeleteLog from '../use-cases/symptoms/delete-log';
import { getPainInsights, getSymptomExerciseCorrelation } from '../db/queries/insights.queries';

export function symptomsRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.post('/', validate(createSymptomLogSchema), auditLog('symptom_log_upserted', 'symptom_log'), async (req, res, next) => {
    try {
      const { log, created } = await UpsertLog.execute(container, { user: req.user!, ...req.body });
      res.status(created ? 201 : 200).json({ data: log });
    } catch (err) { next(err); }
  });

  router.get('/', validate(symptomListQuerySchema, 'query'), auditLog('symptom_logs_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const { items, hasMore } = await ListLogs.execute(container, { user: req.user!, cursor, limit });
      const meta = buildCursorMeta(items, limit, 'logged_at');
      res.json({ data: items, meta: { ...meta, hasMore } });
    } catch (err) { next(err); }
  });

  // Both /stats and /calendar must be defined before /:id to prevent
  // Express matching the literal path as a UUID param.
  router.get('/stats', auditLog('symptom_stats_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      res.json({ data: await GetStats.execute(container, { user: req.user! }) });
    } catch (err) { next(err); }
  });

  router.get('/calendar', validate(symptomCalendarQuerySchema, 'query'), auditLog('symptom_calendar_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      res.json({ data: await GetCalendar.execute(container, { user: req.user!, year, month }) });
    } catch (err) { next(err); }
  });

  router.get('/insights', auditLog('symptom_insights_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      res.json({ data: await getPainInsights(container.db, req.user!.id, days) });
    } catch (err) { next(err); }
  });

  router.get('/correlation', auditLog('symptom_correlation_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      res.json({ data: await getSymptomExerciseCorrelation(container.db, req.user!.id, days) });
    } catch (err) { next(err); }
  });

  router.get('/:id', auditLog('symptom_log_viewed', 'symptom_log'), async (req, res, next) => {
    try {
      res.json({ data: await GetLog.execute(container, { user: req.user!, id: req.params.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/:id', validate(updateSymptomLogSchema), auditLog('symptom_log_updated', 'symptom_log'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateLog.execute(container, { user: req.user!, id: req.params.id, ...req.body }) });
    } catch (err) { next(err); }
  });

  router.delete('/:id', auditLog('symptom_log_deleted', 'symptom_log'), async (req, res, next) => {
    try {
      await DeleteLog.execute(container, { user: req.user!, id: req.params.id });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  return router;
}
