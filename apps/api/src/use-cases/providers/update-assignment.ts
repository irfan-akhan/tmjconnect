import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { updateAssignment } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateAssignmentInput = {
  providerId: string;
  assignmentId: string;
  fields: {
    frequency?: string;
    sets?: number;
    status?: 'active' | 'paused' | 'completed';
  };
};

export async function execute(deps: Deps, input: UpdateAssignmentInput) {
  const updated = await updateAssignment(deps.db, input.assignmentId, input.providerId, input.fields);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Assignment not found.');
  return updated;
}
