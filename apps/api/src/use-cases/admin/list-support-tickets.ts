import type { Container } from '../../config/container';
import {
  listSupportTicketsForAdmin,
  countSupportTicketsForAdmin,
  type AdminSupportTicketListFilters,
} from '../../db/queries/support-tickets.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ListSupportTicketsInput = {
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'status' | 'category' | 'email';
  sortOrder?: SortOrder;
} & AdminSupportTicketListFilters;

export async function execute(deps: Deps, input: ListSupportTicketsInput) {
  const { limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;

  const [items, total] = await Promise.all([
    listSupportTicketsForAdmin(deps.db, limit, offset, filters, sortBy, sortOrder),
    countSupportTicketsForAdmin(deps.db, filters),
  ]);

  return {
    items,
    meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder },
  };
}
