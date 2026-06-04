import type { Container } from '../../config/container';
import { listAssignments } from '../../db/queries/exercises.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetAssignmentsInput = {
  user: ScopedUser;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function execute(deps: Deps, input: GetAssignmentsInput) {
  return listAssignments(deps.db, input.user, {
    status: input.status,
    limit: input.limit,
    offset: input.offset,
  });
}
