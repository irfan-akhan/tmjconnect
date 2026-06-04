import type { Container } from '../../config/container';
import { listActiveSessions, countActiveSessions, getSessionSummary } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type Input = {
  limit: number;
  offset: number;
  sortBy?: 'last_active' | 'created_at' | 'user_email' | 'user_role';
  sortOrder?: SortOrder;
  role?: string;
};

export async function execute(deps: Deps, input: Input) {
  const { limit, offset, sortBy, sortOrder = 'desc', role } = input;
  const [items, total, summary] = await Promise.all([
    listActiveSessions(deps.db, limit, offset, role, sortBy, sortOrder),
    countActiveSessions(deps.db, role),
    getSessionSummary(deps.db),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder }, summary };
}
