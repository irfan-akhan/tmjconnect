import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getAssignmentById } from '../../db/queries/exercises.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetAssignmentByIdInput = {
  user: ScopedUser;
  assignmentId: string;
};

export async function execute(deps: Deps, input: GetAssignmentByIdInput) {
  const item = await getAssignmentById(deps.db, input.user, input.assignmentId);
  if (!item) {
    throw new AppError(404, 'NOT_FOUND', 'Assignment not found.');
  }
  return item;
}
