import type { Container } from '../../config/container';
import { listUsers, countUsers } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type ListUsersInput = {
  page: number;
  limit: number;
  search?: string;
  role?: 'patient' | 'provider' | 'admin';
  is_active?: boolean;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListUsersInput) {
  const { page, limit, ...filters } = input;
  const [items, total] = await Promise.all([
    listUsers(deps.db, page, limit, filters),
    countUsers(deps.db, filters),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
