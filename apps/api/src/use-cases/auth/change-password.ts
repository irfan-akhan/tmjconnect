import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findUserPasswordHash,
  getUserEmailProfile,
  updateUserPassword,
  deleteAllTokensAndSessions,
} from '../../db/queries/auth.queries';
import { comparePassword, hashPassword } from '../../utils/hash';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type ChangePasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};

export async function execute(deps: Deps, input: ChangePasswordInput): Promise<void> {
  const { db } = deps;

  const user = await findUserPasswordHash(db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const match = await comparePassword(input.currentPassword, user.password_hash);
  if (!match) throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect.');

  await updateUserPassword(db, input.userId, await hashPassword(input.newPassword));

  // Invalidate every session and refresh token — including the current device.
  // A password change must force re-authentication everywhere so any device
  // that was signed in under the old credentials (e.g. a compromised one) is
  // locked out. Passing no exceptDeviceInfo deletes ALL of the user's tokens
  // and sessions; the client is then prompted to log in again.
  await deleteAllTokensAndSessions(db, input.userId);

  const contact = await getUserEmailProfile(db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendPasswordChanged(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Password change email failed'));
  }
}
