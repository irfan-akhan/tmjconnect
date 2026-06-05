import type { Container } from '../../config/container';
import { deleteAllTokensAndSessions, getUserEmailProfile } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type LogoutAllInput = { userId: string; currentDeviceInfo?: string };

export async function execute(deps: Deps, input: LogoutAllInput): Promise<void> {
  await deleteAllTokensAndSessions(deps.db, input.userId, input.currentDeviceInfo);
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendSessionsRevoked(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Sessions revoked email failed'));
  }
}
