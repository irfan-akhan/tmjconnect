import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserPasswordHash, updateUserPassword } from '../../db/queries/auth.queries';
import { comparePassword, hashPassword } from '../../utils/hash';

type Deps = Pick<Container, 'db'>;

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
}
