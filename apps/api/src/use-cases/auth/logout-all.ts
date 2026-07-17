import type { Container } from '../../config/container';
import {
  deleteAllTokensAndSessions,
  deleteAllTokensAndSessionsExceptFamily,
  findRefreshTokenByHash,
  findUserPasswordHash,
  getUserEmailProfile,
} from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword, hashToken } from '../../utils/hash';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type LogoutAllInput = {
  userId: string;
  password: string;
  currentRefreshToken?: string;
  currentDeviceInfo?: string;
};

export async function execute(deps: Deps, input: LogoutAllInput): Promise<void> {
  const user = await findUserPasswordHash(deps.db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const passwordOk = await comparePassword(input.password, user.password_hash);
  if (!passwordOk) throw new AppError(400, 'INVALID_PASSWORD', 'Password is incorrect.');

  // Prefer keeping the caller's exact login (token_family) so other logins on the
  // SAME device are signed out too. The token row still resolves the family even
  // if it was already rotated. Fall back to device-based revocation when we can't
  // identify the current login.
  let exceptFamily: string | null = null;
  if (input.currentRefreshToken) {
    const stored = await findRefreshTokenByHash(deps.db, hashToken(input.currentRefreshToken));
    if (stored && stored.user_id === input.userId) exceptFamily = stored.token_family;
  }

  if (exceptFamily) {
    await deleteAllTokensAndSessionsExceptFamily(deps.db, input.userId, exceptFamily);
  } else {
    await deleteAllTokensAndSessions(deps.db, input.userId, input.currentDeviceInfo);
  }
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendSessionsRevoked(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Sessions revoked email failed'));
  }
}
