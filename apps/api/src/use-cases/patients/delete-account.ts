import type { Container } from '../../config/container';
import { deleteAccountTransaction } from '../../db/queries/patients.queries';
import { getUserEmailProfile } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type DeleteAccountInput = { userId: string };

export async function execute(deps: Deps, input: DeleteAccountInput): Promise<void> {
  const contact = await getUserEmailProfile(deps.db, input.userId).catch(() => null);
  await deleteAccountTransaction(deps.db, input.userId);
  if (contact?.email) {
    deps.email.sendAccountDeleted(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Account deletion email failed'));
  }
}
