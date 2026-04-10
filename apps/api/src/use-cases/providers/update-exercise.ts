import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findExerciseById, updateExercise } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateExerciseInput = {
  providerId: string;
  exerciseId: string;
  fields: {
    title?: string;
    description?: string | null;
    duration_seconds?: number | null;
    category?: string | null;
    instructions?: string | null;
    video_url?: string | null;
    thumbnail_url?: string | null;
  };
};

export async function execute(deps: Deps, input: UpdateExerciseInput) {
  const updated = await updateExercise(deps.db, input.exerciseId, input.providerId, input.fields);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Exercise not found.');
  return updated;
}
