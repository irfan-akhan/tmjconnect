import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  verifyProviderLink,
  findExerciseById,
  insertAssignment,
} from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type CreateAssignmentInput = {
  providerId: string;
  patientId: string;
  exerciseId: string;
  frequency: string;
  sets: number;
};

export async function execute(deps: Deps, input: CreateAssignmentInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const exercise = await findExerciseById(deps.db, input.exerciseId, input.providerId);
  if (!exercise) throw new AppError(404, 'NOT_FOUND', 'Exercise not found in your library.');

  return insertAssignment(deps.db, {
    exercise_id: input.exerciseId,
    patient_id: input.patientId,
    provider_id: input.providerId,
    frequency: input.frequency,
    sets: input.sets,
  });
}
