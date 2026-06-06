import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getSupportTicketForAdmin } from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db'>;

export type GetSupportTicketInput = {
  id: string;
};

export async function execute(deps: Deps, input: GetSupportTicketInput) {
  const item = await getSupportTicketForAdmin(deps.db, input.id);
  if (!item) {
    throw new AppError(404, 'NOT_FOUND', 'Support ticket not found.');
  }
  return item;
}
