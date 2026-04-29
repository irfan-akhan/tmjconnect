import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { createSupportTicketSchema } from '@tmjconnect/shared';
import * as CreateTicket from '../use-cases/support/create-ticket';
import * as ListTickets from '../use-cases/support/list-tickets';

export function supportRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  router.post(
    '/tickets',
    validate(createSupportTicketSchema),
    auditLog('support_ticket_created', 'support_ticket'),
    async (req, res, next) => {
      try {
        const ticket = await CreateTicket.execute(container, {
          userId: req.user!.id,
          category: req.body.category,
          subject: req.body.subject,
          body: req.body.body,
          attach_diagnostic: Boolean(req.body.attach_diagnostic),
        });
        res.locals.auditResourceId = ticket.id;
        res.status(201).json({ data: ticket });
      } catch (err) { next(err); }
    },
  );

  router.get('/tickets', auditLog('support_tickets_viewed', 'support_ticket'), async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
      res.json({ data: await ListTickets.execute(container, { userId: req.user!.id, limit }) });
    } catch (err) { next(err); }
  });

  return router;
}
