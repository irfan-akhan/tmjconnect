import type { Container } from '../../config/container';
import {
  listSupportTicketsForUser,
  type UserSupportTicketListFilters,
} from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db'>;

export type ListTicketsInput = {
  userId: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'category' | 'status';
  sortOrder?: 'asc' | 'desc';
} & UserSupportTicketListFilters;

export async function execute(deps: Deps, input: ListTicketsInput) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const sortOrder = input.sortOrder ?? 'desc';
  const items = await listSupportTicketsForUser(
    deps.db,
    input.userId,
    limit,
    offset,
    input.sortBy,
    sortOrder,
    {
      search: input.search,
      status: input.status,
      category: input.category,
    },
  );
  return { items, meta: { limit, offset, hasMore: items.length === limit, sortBy: input.sortBy, sortOrder } };
}
