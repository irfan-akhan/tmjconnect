import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteExercise } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type DeleteExerciseInput = { providerId: string; exerciseId: string };

export async function execute(deps: Deps, input: DeleteExerciseInput) {
  const deleted = await deleteExercise(deps.db, input.exerciseId, input.providerId);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Exercise not found.');
}
