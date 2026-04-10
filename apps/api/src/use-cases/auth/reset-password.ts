import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findPasswordResetByHash, consumePasswordResetTransaction } from '../../db/queries/auth.queries';
import { hashToken, hashPassword } from '../../utils/hash';

type Deps = Pick<Container, 'db'>;

export type ResetPasswordInput = { token: string; new_password: string };

export async function execute(deps: Deps, input: ResetPasswordInput): Promise<void> {
  const { db } = deps;

  const tokenHash = hashToken(input.token);
  const reset = await findPasswordResetByHash(db, tokenHash);

  if (!reset || reset.used || new Date() > reset.expires_at) {
    throw new AppError(400, 'INVALID_TOKEN', 'Reset token is invalid or expired.');
  }

  const newHash = await hashPassword(input.new_password);
  await consumePasswordResetTransaction(db, reset.id, reset.user_id, newHash);
}
