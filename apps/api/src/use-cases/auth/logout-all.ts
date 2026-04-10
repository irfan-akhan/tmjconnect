import type { Container } from '../../config/container';
import { deleteAllTokensAndSessions } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db'>;

export type LogoutAllInput = { userId: string };

export async function execute(deps: Deps, input: LogoutAllInput): Promise<void> {
  await deleteAllTokensAndSessions(deps.db, input.userId);
}
