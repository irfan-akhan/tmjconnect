import type { Container } from '../../config/container';
import { listSupportTicketsForUser } from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps, input: { userId: string; limit?: number }) {
  return listSupportTicketsForUser(deps.db, input.userId, input.limit ?? 20);
}
