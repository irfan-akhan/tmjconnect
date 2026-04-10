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
import * as GetLog from '../use-cases/symptoms/get-log';
import * as UpdateLog from '../use-cases/symptoms/update-log';

export function symptomsRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.post('/', validate(createSymptomLogSchema), auditLog('symptom_log_upserted', 'symptom_log'), async (req, res, next) => {
    try {
      const { log, created } = await UpsertLog.execute(container, { userId: req.user!.id, ...req.body });
      res.status(created ? 201 : 200).json({ data: log });
    } catch (err) { next(err); }
  });

  router.get('/', validate(symptomListQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const { items, hasMore } = await ListLogs.execute(container, { userId: req.user!.id, cursor, limit });
      const meta = buildCursorMeta(items, limit, 'logged_at');
      res.json({ data: items, meta: { ...meta, hasMore } });
    } catch (err) { next(err); }
  });

  // Must be defined before /:id to prevent route conflict.
  router.get('/calendar', validate(symptomCalendarQuerySchema, 'query'), async (req, res, next) => {
    try {
      const year = parseInt(req.query.year as string, 10);
      const month = parseInt(req.query.month as string, 10);
      res.json({ data: await GetCalendar.execute(container, { userId: req.user!.id, year, month }) });
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      res.json({ data: await GetLog.execute(container, { userId: req.user!.id, id: req.params.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/:id', validate(updateSymptomLogSchema), auditLog('symptom_log_updated', 'symptom_log'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateLog.execute(container, { userId: req.user!.id, id: req.params.id, ...req.body }) });
    } catch (err) { next(err); }
  });

  return router;
}
