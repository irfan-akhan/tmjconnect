import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { createSupportTicketSchema, supportTicketListQuerySchema } from '@tmjconnect/shared';
import { parseListQuery, buildListResponse } from '../utils/listHelpers';
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

  router.get('/tickets', validate(supportTicketListQuerySchema, 'query'), auditLog('support_tickets_viewed', 'support_ticket'), async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder } = parseListQuery(req.query);
      const { search, status, category } = req.query as unknown as {
        search?: string;
        status?: 'open' | 'in_progress' | 'resolved' | 'closed';
        category?: 'technical' | 'billing' | 'clinical' | 'feature' | 'other';
      };
      const result = await ListTickets.execute(container, {
        userId: req.user!.id,
        limit,
        offset,
        sortBy: sortBy as ListTickets.ListTicketsInput['sortBy'],
        sortOrder,
        search,
        status,
        category,
      });
      res.json(buildListResponse(result.items, limit, offset, undefined, sortBy, sortOrder));
    } catch (err) { next(err); }
  });

  return router;
}
