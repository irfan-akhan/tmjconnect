import type { Container } from '../../config/container';
import { listLinkedPatients, countLinkedPatients } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ListPatientsInput = {
  providerId: string;
  limit: number;
  offset: number;
  search?: string;
  sortBy?: 'linked_at' | 'last_symptom_at' | 'avg_pain_7d' | 'first_name' | 'last_name';
  sortOrder?: SortOrder;
};

export async function execute(deps: Deps, input: ListPatientsInput) {
  const [items, total] = await Promise.all([
    listLinkedPatients(deps.db, input.providerId, input.limit, input.offset, input.search, input.sortBy, input.sortOrder),
    countLinkedPatients(deps.db, input.providerId, input.search),
  ]);
  return {
    items,
    meta: { limit: input.limit, offset: input.offset, total, hasMore: input.offset + input.limit < total, sortBy: input.sortBy, sortOrder: input.sortOrder ?? 'desc' },
  };
}
