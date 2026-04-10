import type { Container } from '../../config/container';
import { deleteAccountTransaction } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type DeleteAccountInput = { userId: string };

export async function execute(deps: Deps, input: DeleteAccountInput): Promise<void> {
  await deleteAccountTransaction(deps.db, input.userId);
}
