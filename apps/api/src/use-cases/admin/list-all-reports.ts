import type { Container } from '../../config/container';
import { listAllReports, countAllReports } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type ListAllReportsInput = {
  limit: number;
  offset: number;
  sortBy?: 'submitted_at' | 'urgency' | 'status' | 'pain_level';
  sortOrder?: SortOrder;
};

export async function execute(deps: Deps, input: ListAllReportsInput) {
  const { limit, offset, sortBy, sortOrder = 'desc' } = input;
  const [items, total] = await Promise.all([
    listAllReports(deps.db, limit, offset, sortBy, sortOrder),
    countAllReports(deps.db),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
