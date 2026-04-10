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

export function patientsRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.get('/me', async (req, res, next) => {
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

  router.get('/me/sessions', async (req, res, next) => {
    try {
      res.json({ data: await ListSessions.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.delete('/me/sessions/:sessionId', auditLog('session_revoked', 'session'), async (req, res, next) => {
    try {
      await RevokeSession.execute(container, { userId: req.user!.id, sessionId: req.params.sessionId });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  router.get('/me/notification-preferences', async (req, res, next) => {
    try {
      res.json({ data: await GetNotificationPrefs.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/me/notification-preferences', validate(updateNotificationPrefsSchema), async (req, res, next) => {
    try {
      res.json({ data: await UpdateNotificationPrefs.execute(container, { userId: req.user!.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  return router;
}
