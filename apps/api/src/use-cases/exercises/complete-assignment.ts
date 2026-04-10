import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findActiveAssignment,
  findTodayCompletion,
  getCompletionById,
  insertCompletion,
} from '../../db/queries/exercises.queries';

type Deps = Pick<Container, 'db'>;

export type CompleteAssignmentInput = { patientId: string; assignmentId: string };
export type CompleteAssignmentOutput = { data: object; alreadyCompleted: boolean };

export async function execute(
  deps: Deps,
  input: CompleteAssignmentInput,
): Promise<CompleteAssignmentOutput> {
  const { db } = deps;

  const assignment = await findActiveAssignment(db, input.assignmentId, input.patientId);
  if (!assignment) throw new AppError(404, 'NOT_FOUND', 'Active assignment not found.');

  const existing = await findTodayCompletion(db, input.assignmentId, input.patientId);
  if (existing) {
    const completion = await getCompletionById(db, existing.id);
    return { data: completion!, alreadyCompleted: true };
  }

  const completion = await insertCompletion(db, input.assignmentId, input.patientId);
  return { data: completion, alreadyCompleted: false };
}
