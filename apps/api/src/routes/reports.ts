import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  submitReportSchema,
  respondToReportSchema,
  reportInboxQuerySchema,
  reportRequestListQuerySchema,
} from '@tmjconnect/shared';
import * as Submit from '../use-cases/reports/submit';
import * as ProviderInbox from '../use-cases/reports/provider-inbox';
import * as GetReport from '../use-cases/reports/get-report';
import * as Respond from '../use-cases/reports/respond';
import * as Review from '../use-cases/reports/review';
import * as Flag from '../use-cases/reports/flag';
import * as ListRequests from '../use-cases/reports/list-requests';
import * as DismissRequest from '../use-cases/reports/dismiss-request';

export function reportsRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  // ─── Patient submission ──────────────────────────────────────────────────────
  router.post('/', authorize('patient'), validate(submitReportSchema), auditLog('report_submitted', 'report'), async (req, res, next) => {
    try {
      const rawKey = req.headers['idempotency-key'];
      const idempotencyKey = (typeof rawKey === 'string' && rawKey.length <= 64) ? rawKey : null;
      const { report, alreadyExists } = await Submit.execute(container, {
        patientId: req.user!.id,
        idempotencyKey,
        ...req.body,
      });
      res.status(alreadyExists ? 200 : 201).json({ data: report });
    } catch (err) { next(err); }
  });

  // ─── Provider inbox (must be defined before /:id to prevent route conflict) ─
  router.get(
    '/inbox',
    authorize('provider'),
    validate(reportInboxQuerySchema, 'query'),
    auditLog('provider_viewed_report_inbox', 'report'),
    async (req, res, next) => {
      try {
        const { page, limit, ...filters } = req.query as unknown as {
          page: number; limit: number;
          status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
          patient_id?: string; from?: string; to?: string;
          urgency?: 'routine' | 'concerning' | 'urgent';
        };
        const result = await ProviderInbox.execute(container, { providerId: req.user!.id, page, limit, ...filters });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  // ─── Report requests ────────────────────────────────────────────────────────
  // Must be declared BEFORE `/:id` routes — otherwise Express matches
  // `/requests` to `/:id` with id='requests' and 500s on the UUID parse.
  router.get(
    '/requests',
    validate(reportRequestListQuerySchema, 'query'),
    auditLog('report_requests_listed', 'report_request'),
    async (req, res, next) => {
      try {
        if (req.user!.role === 'patient') {
          const data = await ListRequests.executeForPatient(container, req.user!.id);
          res.json({ data });
          return;
        }
        const { status, patient_id } = req.query as unknown as {
          status?: 'pending' | 'fulfilled' | 'dismissed';
          patient_id?: string;
        };
        const data = await ListRequests.executeForProvider(container, {
          providerId: req.user!.id,
          patientId: patient_id,
          status,
        });
        res.json({ data });
      } catch (err) { next(err); }
    },
  );

  router.delete(
    '/requests/:id',
    auditLog('report_request_dismissed', 'report_request'),
    async (req, res, next) => {
      try {
        await DismissRequest.execute(container, {
          userId: req.user!.id,
          role: req.user!.role as 'patient' | 'provider',
          requestId: req.params.id,
        });
        res.status(204).send();
      } catch (err) { next(err); }
    },
  );

  // ─── Get single report (both roles) ─────────────────────────────────────────
  router.get('/:id', auditLog('report_viewed', 'report'), async (req, res, next) => {
    try {
      const result = await GetReport.execute(container, {
        userId: req.user!.id,
        role: req.user!.role as 'patient' | 'provider',
        reportId: req.params.id,
      });
      res.json({ data: result });
    } catch (err) { next(err); }
  });

  // ─── Provider actions ───────────────────────────────────────────────────────
  router.post('/:id/respond', authorize('provider'), validate(respondToReportSchema), auditLog('report_responded', 'report'), async (req, res, next) => {
    try {
      const data = await Respond.execute(container, {
        providerId: req.user!.id,
        reportId: req.params.id,
        message: req.body.message,
        internal_notes: req.body.internal_notes,
      });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  router.patch('/:id/review', authorize('provider'), auditLog('report_reviewed', 'report'), async (req, res, next) => {
    try {
      await Review.execute(container, { providerId: req.user!.id, reportId: req.params.id });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  router.patch('/:id/flag', authorize('provider'), auditLog('report_flagged', 'report'), async (req, res, next) => {
    try {
      const result = await Flag.execute(container, { providerId: req.user!.id, reportId: req.params.id });
      res.json({ data: result });
    } catch (err) { next(err); }
  });

  return router;
}
