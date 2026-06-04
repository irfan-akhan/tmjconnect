import type { Container } from '../../config/container';
import { listProviderExercises, countProviderExercises } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ListExercisesInput = {
  providerId: string;
  limit: number;
  offset: number;
  category?: string;
  sortBy?: 'created_at' | 'title' | 'category';
  sortOrder?: SortOrder;
};

export async function execute(deps: Deps, input: ListExercisesInput) {
  const [items, total] = await Promise.all([
    listProviderExercises(deps.db, input.providerId, input.limit, input.offset, input.category, input.sortBy, input.sortOrder),
    countProviderExercises(deps.db, input.providerId, input.category),
  ]);
  return {
    items,
    meta: { limit: input.limit, offset: input.offset, total, hasMore: input.offset + input.limit < total, sortBy: input.sortBy, sortOrder: input.sortOrder ?? 'desc' },
  };
}
