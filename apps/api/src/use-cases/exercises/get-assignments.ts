import type { Container } from '../../config/container';
import { listActiveAssignments } from '../../db/queries/exercises.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetAssignmentsInput = { user: ScopedUser };

export async function execute(deps: Deps, input: GetAssignmentsInput) {
  return listActiveAssignments(deps.db, input.user);
}
