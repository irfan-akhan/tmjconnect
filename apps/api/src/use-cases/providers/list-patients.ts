import type { Container } from '../../config/container';
import { listLinkedPatients, countLinkedPatients } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientsInput = {
  providerId: string;
  page: number;
  limit: number;
  search?: string;
};

export async function execute(deps: Deps, input: ListPatientsInput) {
  const [items, total] = await Promise.all([
    listLinkedPatients(deps.db, input.providerId, input.page, input.limit, input.search),
    countLinkedPatients(deps.db, input.providerId, input.search),
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
