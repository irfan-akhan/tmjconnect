import type { Container } from '../../config/container';
import { listAuditLogs, countAuditLogs } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type ListAuditLogsInput = {
  page: number;
  limit: number;
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListAuditLogsInput) {
  const { page, limit, ...filters } = input;
  const [items, total] = await Promise.all([
    listAuditLogs(deps.db, page, limit, filters),
    countAuditLogs(deps.db, filters),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
