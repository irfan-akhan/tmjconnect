import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserPasswordHash, getUserEmailProfile, updateUserPassword } from '../../db/queries/auth.queries';
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
  const contact = await getUserEmailProfile(db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendPasswordChanged(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Password change email failed'));
  }
}
