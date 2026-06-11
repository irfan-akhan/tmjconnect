import type { Container } from '../../config/container';
import { deleteAllTokensAndSessions, findUserPasswordHash, getUserEmailProfile } from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword } from '../../utils/hash';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type LogoutAllInput = { userId: string; password: string; currentDeviceInfo?: string };

export async function execute(deps: Deps, input: LogoutAllInput): Promise<void> {
  const user = await findUserPasswordHash(deps.db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const passwordOk = await comparePassword(input.password, user.password_hash);
  if (!passwordOk) throw new AppError(400, 'INVALID_PASSWORD', 'Password is incorrect.');

  await deleteAllTokensAndSessions(deps.db, input.userId, input.currentDeviceInfo);
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendSessionsRevoked(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Sessions revoked email failed'));
  }
}
