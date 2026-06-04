import type { Container } from '../../config/container';
import { listAuditLogs, countAuditLogs } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type ListAuditLogsInput = {
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'action' | 'resource_type';
  sortOrder?: SortOrder;
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListAuditLogsInput) {
  const { limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;
  const [items, total] = await Promise.all([
    listAuditLogs(deps.db, limit, offset, filters, sortBy, sortOrder),
    countAuditLogs(deps.db, filters),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
