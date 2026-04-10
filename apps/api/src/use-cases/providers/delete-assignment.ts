import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteAssignment } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type DeleteAssignmentInput = { providerId: string; assignmentId: string };

export async function execute(deps: Deps, input: DeleteAssignmentInput) {
  const deleted = await deleteAssignment(deps.db, input.assignmentId, input.providerId);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Assignment not found.');
}
