import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteSessionById } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type RevokeSessionInput = { userId: string; sessionId: string };

export async function execute(deps: Deps, input: RevokeSessionInput): Promise<void> {
  const deleted = await deleteSessionById(deps.db, input.sessionId, input.userId);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Session not found.');
}
