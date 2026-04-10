import type { Container } from '../../config/container';
import { listProviderExercises, countProviderExercises } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type ListExercisesInput = {
  providerId: string;
  page: number;
  limit: number;
  category?: string;
};

export async function execute(deps: Deps, input: ListExercisesInput) {
  const [items, total] = await Promise.all([
    listProviderExercises(deps.db, input.providerId, input.page, input.limit, input.category),
    countProviderExercises(deps.db, input.providerId, input.category),
  ]);
  return {
    items,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
