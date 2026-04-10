import type { Container } from '../../config/container';
import { getActiveSessions } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type ListSessionsInput = { userId: string };

export async function execute(deps: Deps, input: ListSessionsInput) {
  return getActiveSessions(deps.db, input.userId);
}
