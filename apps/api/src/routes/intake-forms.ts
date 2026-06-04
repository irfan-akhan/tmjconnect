import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize, checkSessionTimeout } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { parseListQuery, buildListResponse } from '../utils/listHelpers';
import { intakeAssignmentListQuerySchema, intakeFormListQuerySchema, intakeResponseListQuerySchema } from '@tmjconnect/shared';
import {
  createForm, updateForm, deleteForm, listForms, getForm,
  assignForm, listAssignmentsByPatient, listResponsesByForm,
  submitResponse,
} from '../db/queries/intake.queries';

export function intakeFormsRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  // ─── Provider: Form CRUD ──────────────────────────────────────────────────

  router.post('/',
    authorize('provider'), checkSessionTimeout(container.db),
    auditLog('intake_form_created', 'intake_form'),
    async (req, res, next) => {
      try {
        const data = await createForm(container.db, req.user!.id, req.body);
        res.locals.auditResourceId = data.id;
        res.status(201).json({ data });
      } catch (err) { next(err); }
    },
  );

  router.get('/',
    authorize('provider'), checkSessionTimeout(container.db),
    validate(intakeFormListQuerySchema, 'query'),
    auditLog('intake_forms_listed', 'intake_form'),
    async (req, res, next) => {
      try {
        const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
        const data = await listForms(container.db, req.user!.id, limit, offset, sortBy as 'updated_at' | 'created_at' | 'title' | 'status' | undefined, sortOrder);
        res.json(buildListResponse(data, limit, offset, undefined, sortBy, sortOrder));
      } catch (err) { next(err); }
    },
  );

  router.get('/:formId',
    auditLog('intake_form_viewed', 'intake_form'),
    async (req, res, next) => {
      try {
        const data = await getForm(container.db, req.params.formId);
        res.json({ data });
      } catch (err) { next(err); }
    },
  );

  router.patch('/:formId',
    authorize('provider'), checkSessionTimeout(container.db),
    auditLog('intake_form_updated', 'intake_form'),
    async (req, res, next) => {
      try {
        const data = await updateForm(container.db, req.user!.id, req.params.formId, req.body);
        res.json({ data });
      } catch (err) { next(err); }
    },
  );

  router.delete('/:formId',
    authorize('provider'), checkSessionTimeout(container.db),
    auditLog('intake_form_deleted', 'intake_form'),
    async (req, res, next) => {
      try {
        await deleteForm(container.db, req.user!.id, req.params.formId);
        res.status(204).end();
      } catch (err) { next(err); }
    },
  );

  // ─── Provider: Assign form to patient ─────────────────────────────────────

  router.post('/:formId/assign',
    authorize('provider'), checkSessionTimeout(container.db),
    auditLog('intake_form_assigned', 'intake_form_assignment'),
    async (req, res, next) => {
      try {
        const data = await assignForm(container.db, req.user!.id, req.params.formId, req.body.patient_id);
        res.status(201).json({ data });
      } catch (err) { next(err); }
    },
  );

  // ─── Provider: View responses ─────────────────────────────────────────────

  router.get('/:formId/responses',
    authorize('provider'), checkSessionTimeout(container.db),
    validate(intakeResponseListQuerySchema, 'query'),
    auditLog('intake_responses_viewed', 'intake_response'),
    async (req, res, next) => {
      try {
        const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
        const data = await listResponsesByForm(container.db, req.user!.id, req.params.formId, limit, offset, sortBy as 'submitted_at' | 'patient_name' | undefined, sortOrder);
        res.json(buildListResponse(data, limit, offset, undefined, sortBy, sortOrder));
      } catch (err) { next(err); }
    },
  );

  // ─── Patient: List pending assignments ────────────────────────────────────

  router.get('/assignments/mine',
    authorize('patient'),
    validate(intakeAssignmentListQuerySchema, 'query'),
    auditLog('patient_intake_assignments_viewed', 'intake_form_assignment'),
    async (req, res, next) => {
      try {
        const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
        const data = await listAssignmentsByPatient(container.db, req.user!.id, limit, offset, sortBy as 'assigned_at' | 'form_title' | 'provider_name' | undefined, sortOrder);
        res.json(buildListResponse(data, limit, offset, undefined, sortBy, sortOrder));
      } catch (err) { next(err); }
    },
  );

  // ─── Patient: Submit response ─────────────────────────────────────────────

  router.post('/:formId/responses',
    authorize('patient'),
    auditLog('intake_response_submitted', 'intake_response'),
    async (req, res, next) => {
      try {
        const data = await submitResponse(container.db, req.user!.id, req.params.formId, req.body.answers);
        res.locals.auditResourceId = data.id;
        res.status(201).json({ data });
      } catch (err) { next(err); }
    },
  );

  return router;
}
