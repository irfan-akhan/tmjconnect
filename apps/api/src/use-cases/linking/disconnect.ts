import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { disconnectLink } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export type DisconnectInput = { userId: string; linkId: string };

export async function execute(deps: Deps, input: DisconnectInput) {
  const disconnected = await disconnectLink(deps.db, input.linkId, input.userId);
  if (!disconnected) throw new AppError(404, 'NOT_FOUND', 'Link not found or already disconnected.');
}
