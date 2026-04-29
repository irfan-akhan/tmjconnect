import type { Container } from '../../config/container';
import { insertSupportTicket } from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db' | 'logger'>;

export type CreateSupportTicketInput = {
  userId: string;
  category: string;
  subject: string;
  body: string;
  attach_diagnostic: boolean;
};

export async function execute(deps: Deps, input: CreateSupportTicketInput) {
  const ticket = await insertSupportTicket(deps.db, {
    user_id: input.userId,
    category: input.category,
    subject: input.subject,
    body: input.body,
    attach_diagnostic: input.attach_diagnostic,
  });
  deps.logger.info(
    { ticketId: ticket.id, userId: input.userId, category: input.category },
    'support ticket created',
  );
  return ticket;
}
