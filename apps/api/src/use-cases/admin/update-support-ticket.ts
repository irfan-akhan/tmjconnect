import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { updateSupportTicketStatus, getSupportTicketForAdmin } from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateSupportTicketInput = {
  id: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
};

export async function execute(deps: Deps, input: UpdateSupportTicketInput) {
  const exists = await getSupportTicketForAdmin(deps.db, input.id);
  if (!exists) {
    throw new AppError(404, 'NOT_FOUND', 'Support ticket not found.');
  }

  const updated = await updateSupportTicketStatus(deps.db, input.id, input.status);
  if (!updated) {
    throw new AppError(500, 'UPDATE_FAILED', 'Failed to update ticket status.');
  }
  return updated;
}
