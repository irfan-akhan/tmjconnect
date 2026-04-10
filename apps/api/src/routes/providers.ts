import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize, checkSessionTimeout } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import {
  updateProviderProfileSchema,
  patientListQuerySchema,
  createExerciseSchema,
  updateExerciseSchema,
  exerciseListQuerySchema,
  createAssignmentSchema,
  updateAssignmentSchema,
  symptomListQuerySchema,
  reportInboxQuerySchema,
} from '@tmjconnect/shared';
import { parseCursorPagination, buildCursorMeta } from '../utils/pagination';
import * as GetProfile from '../use-cases/providers/get-profile';
import * as UpdateProfile from '../use-cases/providers/update-profile';
import * as ListPatients from '../use-cases/providers/list-patients';
import * as GetPatientDetail from '../use-cases/providers/get-patient-detail';
import * as ListPatientSymptoms from '../use-cases/providers/list-patient-symptoms';
import * as ListPatientReports from '../use-cases/providers/list-patient-reports';
import * as ListSessions from '../use-cases/providers/list-sessions';
import * as RevokeSession from '../use-cases/providers/revoke-session';
import * as ListExercises from '../use-cases/providers/list-exercises';
import * as CreateExercise from '../use-cases/providers/create-exercise';
import * as UpdateExercise from '../use-cases/providers/update-exercise';
import * as DeleteExercise from '../use-cases/providers/delete-exercise';
import * as CreateAssignment from '../use-cases/providers/create-assignment';
import * as UpdateAssignment from '../use-cases/providers/update-assignment';
import * as DeleteAssignment from '../use-cases/providers/delete-assignment';
import * as ListPatientAssignments from '../use-cases/providers/list-patient-assignments';

export function providersRouter(container: Container) {
  const router = Router();
  // Provider sessions enforce a 15-minute inactivity timeout (HIPAA — Section 8.2).
  // checkSessionTimeout refreshes last_active on every authenticated request OR
  // deletes the session and returns 401 SESSION_TIMEOUT if it has gone stale.
  router.use(authenticate, authorize('provider'), checkSessionTimeout(container.db));

  // ─── Profile ─────────────────────────────────────────────────────────────────
  router.get('/me', async (req, res, next) => {
    try {
      res.json({ data: await GetProfile.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.patch('/me', validate(updateProviderProfileSchema), auditLog('provider_profile_updated', 'user'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateProfile.execute(container, { userId: req.user!.id, fields: req.body }) });
    } catch (err) { next(err); }
  });

  // ─── Patient dashboard ───────────────────────────────────────────────────────
  router.get(
    '/patients',
    validate(patientListQuerySchema, 'query'),
    auditLog('provider_listed_patients', 'user'),
    async (req, res, next) => {
      try {
        const { page, limit, search } = req.query as unknown as { page: number; limit: number; search?: string };
        const result = await ListPatients.execute(container, { providerId: req.user!.id, page, limit, search });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/patients/:patientId',
    auditLog('provider_viewed_patient_detail', 'user'),
    async (req, res, next) => {
      try {
        res.json({ data: await GetPatientDetail.execute(container, { providerId: req.user!.id, patientId: req.params.patientId }) });
      } catch (err) { next(err); }
    },
  );

  // ─── Patient clinical history (read-only, link-scoped) ──────────────────────
  router.get(
    '/patients/:patientId/symptoms',
    validate(symptomListQuerySchema, 'query'),
    auditLog('provider_viewed_patient_symptoms', 'symptom_log'),
    async (req, res, next) => {
      try {
        const { cursor, limit } = parseCursorPagination(req.query);
        const { items, hasMore } = await ListPatientSymptoms.execute(container, {
          providerId: req.user!.id,
          patientId: req.params.patientId,
          cursor,
          limit,
        });
        const meta = buildCursorMeta(items, limit, 'logged_at');
        res.json({ data: items, meta: { ...meta, hasMore } });
      } catch (err) { next(err); }
    },
  );

  router.get(
    '/patients/:patientId/reports',
    validate(reportInboxQuerySchema, 'query'),
    auditLog('provider_viewed_patient_reports', 'report'),
    async (req, res, next) => {
      try {
        const { page, limit, status, urgency, from, to } = req.query as unknown as {
          page: number;
          limit: number;
          status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
          urgency?: 'routine' | 'concerning' | 'urgent';
          from?: string;
          to?: string;
        };
        const result = await ListPatientReports.execute(container, {
          providerId: req.user!.id,
          patientId: req.params.patientId,
          page,
          limit,
          status,
          urgency,
          from,
          to,
        });
        res.json({ data: result.items, meta: result.meta });
      } catch (err) { next(err); }
    },
  );

  // ─── Sessions (security UI) ─────────────────────────────────────────────────
  router.get('/me/sessions', async (req, res, next) => {
    try {
      res.json({ data: await ListSessions.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.delete(
    '/me/sessions/:sessionId',
    auditLog('session_revoked', 'session'),
    async (req, res, next) => {
      try {
        await RevokeSession.execute(container, {
          userId: req.user!.id,
          sessionId: req.params.sessionId,
        });
        res.status(204).send();
      } catch (err) { next(err); }
    },
  );

  // ─── Patient assignments (provider manages) ─────────────────────────────────
  router.get('/patients/:patientId/assignments', async (req, res, next) => {
    try {
      res.json({ data: await ListPatientAssignments.execute(container, { providerId: req.user!.id, patientId: req.params.patientId }) });
    } catch (err) { next(err); }
  });

  router.post('/patients/:patientId/assignments', validate(createAssignmentSchema), auditLog('assignment_created', 'exercise_assignment'), async (req, res, next) => {
    try {
      const data = await CreateAssignment.execute(container, {
        providerId: req.user!.id,
        patientId: req.params.patientId,
        exerciseId: req.body.exercise_id,
        frequency: req.body.frequency,
        sets: req.body.sets,
      });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  router.patch('/assignments/:assignmentId', validate(updateAssignmentSchema), auditLog('assignment_updated', 'exercise_assignment'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateAssignment.execute(container, { providerId: req.user!.id, assignmentId: req.params.assignmentId, fields: req.body }) });
    } catch (err) { next(err); }
  });

  router.delete('/assignments/:assignmentId', auditLog('assignment_deleted', 'exercise_assignment'), async (req, res, next) => {
    try {
      await DeleteAssignment.execute(container, { providerId: req.user!.id, assignmentId: req.params.assignmentId });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  // ─── Exercise library ────────────────────────────────────────────────────────
  router.get('/exercises', validate(exerciseListQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { page, limit, category } = req.query as unknown as { page: number; limit: number; category?: string };
      const result = await ListExercises.execute(container, { providerId: req.user!.id, page, limit, category });
      res.json({ data: result.items, meta: result.meta });
    } catch (err) { next(err); }
  });

  router.post('/exercises', validate(createExerciseSchema), auditLog('exercise_created', 'exercise'), async (req, res, next) => {
    try {
      const data = await CreateExercise.execute(container, { providerId: req.user!.id, ...req.body });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  router.patch('/exercises/:exerciseId', validate(updateExerciseSchema), auditLog('exercise_updated', 'exercise'), async (req, res, next) => {
    try {
      res.json({ data: await UpdateExercise.execute(container, { providerId: req.user!.id, exerciseId: req.params.exerciseId, fields: req.body }) });
    } catch (err) { next(err); }
  });

  router.delete('/exercises/:exerciseId', auditLog('exercise_deleted', 'exercise'), async (req, res, next) => {
    try {
      await DeleteExercise.execute(container, { providerId: req.user!.id, exerciseId: req.params.exerciseId });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
