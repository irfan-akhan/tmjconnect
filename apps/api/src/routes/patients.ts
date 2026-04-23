import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { updatePatientProfileSchema, updateNotificationPrefsSchema } from '@tmjconnect/shared';
import * as GetProfile from '../use-cases/patients/get-profile';
import * as UpdateProfile from '../use-cases/patients/update-profile';
import * as DeleteAccount from '../use-cases/patients/delete-account';
import * as ListSessions from '../use-cases/patients/list-sessions';
import * as RevokeSession from '../use-cases/patients/revoke-session';
import * as GetNotificationPrefs from '../use-cases/patients/get-notification-prefs';
import * as UpdateNotificationPrefs from '../use-cases/patients/update-notification-prefs';
import * as ExportData from '../use-cases/patients/export-data';
import * as ListActivity from '../use-cases/patients/list-activity';
import * as GetDashboard from '../use-cases/patients/get-dashboard';

export function patientsRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.get('/dashboard', auditLog('patient_dashboard_viewed', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await GetDashboard.execute(container, { user: req.user! }) });
    } catch (err) { next(err); }
  });

  router.get('/me', auditLog('patient_profile_viewed', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await GetProfile.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/me', validate(updatePatientProfileSchema), auditLog('profile_updated', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateProfile.execute(container, { userId: req.user!.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  router.delete('/me', auditLog('account_deletion_requested', 'user'), async (req, res, next) => {
    try {
      await DeleteAccount.execute(container, { userId: req.user!.id });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  router.get('/me/sessions', auditLog('patient_sessions_viewed', 'session'), async (req, res, next) => {
    try {
      res.json({ data: await ListSessions.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.get('/me/activity', auditLog('patient_activity_viewed', 'user'), async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
      const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
      const result = await ListActivity.execute(container, {
        userId: req.user!.id,
        limit,
        offset,
      });
      res.json({ data: result.items, meta: { limit, offset, hasMore: result.hasMore } });
    } catch (err) { next(err); }
  });

  router.delete('/me/sessions/:sessionId', auditLog('session_revoked', 'session'), async (req, res, next) => {
    try {
      await RevokeSession.execute(container, { userId: req.user!.id, sessionId: req.params.sessionId });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  router.get('/me/notification-preferences', auditLog('patient_notification_prefs_viewed', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await GetNotificationPrefs.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/me/notification-preferences', validate(updateNotificationPrefsSchema), async (req, res, next) => {
    try {
      res.json({ data: await UpdateNotificationPrefs.execute(container, { userId: req.user!.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  // ─── HIPAA right-of-access: full PHI export ─────────────────────────────────
  // Synchronous export; pilot scale (25–50 users). For production scale, move
  // to an async job that emits a signed download URL when complete.
  router.get(
    '/me/export',
    auditLog('patient_data_exported', 'user'),
    async (req, res, next) => {
      try {
        const data = await ExportData.execute(container, { patientId: req.user!.id });
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="tmjconnect-export-${req.user!.id}-${new Date().toISOString().slice(0, 10)}.json"`,
        );
        res.json({ data });
      } catch (err) { next(err); }
    },
  );

  return router;
}
