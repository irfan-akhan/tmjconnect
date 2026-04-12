import type { Container } from '../../config/container';
import { listJobHistory, countJobHistory } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type Input = { jobName: string; page: number; limit: number };

export async function execute(deps: Deps, input: Input) {
  const [items, total] = await Promise.all([
    listJobHistory(deps.db, input.jobName, input.page, input.limit),
    countJobHistory(deps.db, input.jobName),
  ]);
  return { items, meta: { page: input.page, limit: input.limit, total } };
}
