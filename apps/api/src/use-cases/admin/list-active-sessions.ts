import type { Container } from '../../config/container';
import { listActiveSessions, countActiveSessions, getSessionSummary } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type Input = { page: number; limit: number; role?: string };

export async function execute(deps: Deps, input: Input) {
  const [items, total, summary] = await Promise.all([
    listActiveSessions(deps.db, input.page, input.limit, input.role),
    countActiveSessions(deps.db, input.role),
    getSessionSummary(deps.db),
  ]);
  return { items, meta: { page: input.page, limit: input.limit, total }, summary };
}
