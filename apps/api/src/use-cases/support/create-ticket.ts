import type { Container } from '../../config/container';
import { insertSupportTicket } from '../../db/queries/support-tickets.queries';
import { getUserEmailProfile } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

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
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendSupportTicketReceived(contact.email, contact.first_name ?? '', ticket.id, input.subject)
      .catch((err) => deps.logger.warn({ err, ticketId: ticket.id }, 'Support ticket confirmation email failed'));
  }
  return ticket;
}
