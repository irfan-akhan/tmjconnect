import type { Container } from '../../config/container';
import { listAllReports, countAllReports } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type ListAllReportsInput = { page: number; limit: number };

export async function execute(deps: Deps, input: ListAllReportsInput) {
  const [items, total] = await Promise.all([
    listAllReports(deps.db, input.page, input.limit),
    countAllReports(deps.db),
  ]);
  return { items, meta: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
}
