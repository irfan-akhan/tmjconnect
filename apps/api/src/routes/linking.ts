import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { acceptLinkingCodeSchema, emailInviteSchema } from '@tmjconnect/shared';
import * as GenerateCode from '../use-cases/linking/generate-code';
import * as ListCodes from '../use-cases/linking/list-codes';
import * as EmailInvite from '../use-cases/linking/email-invite';
import * as AcceptCode from '../use-cases/linking/accept-code';
import * as Disconnect from '../use-cases/linking/disconnect';
import * as ListLinks from '../use-cases/linking/list-links';

export function linkingRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  // ─── View active links (both roles) ──────────────────────────────────────────
  router.get('/links', auditLog('links_viewed', 'patient_provider_link'), async (req, res, next) => {
    try {
      res.json({ data: await ListLinks.execute(container, { userId: req.user!.id, role: req.user!.role }) });
    } catch (err) { next(err); }
  });

  // ─── Disconnect (both roles) ─────────────────────────────────────────────────
  router.delete('/links/:linkId', auditLog('link_disconnected', 'patient_provider_link'), async (req, res, next) => {
    try {
      await Disconnect.execute(container, { userId: req.user!.id, linkId: req.params.linkId });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  // ─── Provider: generate and manage codes ─────────────────────────────────────
  router.post('/codes', authorize('provider'), auditLog('linking_code_generated', 'linking_code'), async (req, res, next) => {
    try {
      const data = await GenerateCode.execute(container, { providerId: req.user!.id });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  router.get('/codes', authorize('provider'), auditLog('linking_codes_viewed', 'linking_code'), async (req, res, next) => {
    try {
      res.json({ data: await ListCodes.execute(container, { providerId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.post(
    '/codes/:code/invite',
    authorize('provider'),
    validate(emailInviteSchema),
    auditLog('linking_invite_sent', 'linking_code'),
    async (req, res, next) => {
      try {
        await EmailInvite.execute(container, {
          providerId: req.user!.id,
          patientEmail: req.body.patient_email,
          code: req.params.code,
        });
        res.status(202).json({ message: 'Invitation email queued.' });
      } catch (err) { next(err); }
    },
  );

  // ─── Patient: accept code ────────────────────────────────────────────────────
  router.post('/accept', authorize('patient'), validate(acceptLinkingCodeSchema), auditLog('linking_code_accepted', 'linking_code'), async (req, res, next) => {
    try {
      const data = await AcceptCode.execute(container, { patientId: req.user!.id, code: req.body.code });
      res.status(201).json({ data });
    } catch (err) { next(err); }
  });

  return router;
}
