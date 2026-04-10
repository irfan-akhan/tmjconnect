import type { Container } from '../../config/container';
import { getActiveSessions } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type ListSessionsInput = { userId: string };

/**
 * Sessions are stored in the role-agnostic `sessions` table — the underlying
 * query is shared with the patient flow.
 */
export async function execute(deps: Deps, input: ListSessionsInput) {
  return getActiveSessions(deps.db, input.userId);
}
