import type { Container } from '../../config/container';
import { insertExercise } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type CreateExerciseInput = {
  providerId: string;
  title: string;
  description?: string | null;
  duration_seconds?: number | null;
  category?: string | null;
  instructions?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
};

export async function execute(deps: Deps, input: CreateExerciseInput) {
  const { providerId, ...data } = input;
  return insertExercise(deps.db, providerId, data);
}
