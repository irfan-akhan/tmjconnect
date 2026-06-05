import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteSessionById } from '../../db/queries/patients.queries';
import { getUserEmailProfile } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type RevokeSessionInput = { userId: string; sessionId: string };

export async function execute(deps: Deps, input: RevokeSessionInput): Promise<void> {
  const deleted = await deleteSessionById(deps.db, input.sessionId, input.userId);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Session not found.');
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendSessionsRevoked(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Session revoked email failed'));
  }
}
