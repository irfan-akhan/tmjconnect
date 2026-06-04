import type { Container } from '../../config/container';
import { listJobHistory, countJobHistory } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type Input = {
  jobName: string;
  limit: number;
  offset: number;
  sortBy?: 'started_at' | 'status' | 'duration_ms';
  sortOrder?: SortOrder;
};

export async function execute(deps: Deps, input: Input) {
  const { jobName, limit, offset, sortBy, sortOrder = 'desc' } = input;
  const [items, total] = await Promise.all([
    listJobHistory(deps.db, jobName, limit, offset, sortBy, sortOrder),
    countJobHistory(deps.db, jobName),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
