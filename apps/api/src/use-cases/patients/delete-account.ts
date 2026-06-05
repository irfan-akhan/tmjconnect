import type { Container } from '../../config/container';
import { deleteAccountTransaction } from '../../db/queries/patients.queries';
import { findUserPasswordHash, getUserEmailProfile } from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword } from '../../utils/hash';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type DeleteAccountInput = { userId: string; password: string };

export async function execute(deps: Deps, input: DeleteAccountInput): Promise<void> {
  const user = await findUserPasswordHash(deps.db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const passwordOk = await comparePassword(input.password, user.password_hash);
  if (!passwordOk) throw new AppError(400, 'INVALID_PASSWORD', 'Password is incorrect.');

  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  await deleteAccountTransaction(deps.db, input.userId);
  if (contact?.email) {
    deps.email.sendAccountDeleted(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Account deletion email failed'));
  }
}
