import type { Container } from '../../config/container';
import { listUserLinks } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export type ListLinksInput = {
  userId: string;
  role: string;
  limit?: number;
  offset?: number;
  sortBy?: 'linked_at' | 'first_name' | 'last_name' | 'email';
  sortOrder?: 'asc' | 'desc';
};

export async function execute(deps: Deps, input: ListLinksInput) {
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const sortOrder = input.sortOrder ?? 'desc';
  const items = await listUserLinks(deps.db, input.userId, input.role, limit, offset, input.sortBy, sortOrder);
  return { items, meta: { limit, offset, hasMore: items.length === limit, sortBy: input.sortBy, sortOrder } };
}
