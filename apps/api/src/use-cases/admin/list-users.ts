import type { Container } from '../../config/container';
import { listUsers, countUsers } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type ListUsersInput = {
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'email' | 'role' | 'is_active';
  sortOrder?: SortOrder;
  search?: string;
  role?: 'patient' | 'provider' | 'admin';
  is_active?: boolean;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListUsersInput) {
  const { limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;
  const [items, total] = await Promise.all([
    listUsers(deps.db, limit, offset, filters, sortBy, sortOrder),
    countUsers(deps.db, filters),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
