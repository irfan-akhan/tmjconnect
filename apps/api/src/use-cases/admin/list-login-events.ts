import type { Container } from '../../config/container';
import { listLoginEvents, countLoginEvents } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type ListLoginEventsInput = {
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'email' | 'success';
  sortOrder?: SortOrder;
  user_id?: string;
  success?: boolean;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListLoginEventsInput) {
  const { limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;
  const [items, total] = await Promise.all([
    listLoginEvents(deps.db, limit, offset, filters, sortBy, sortOrder),
    countLoginEvents(deps.db, filters),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
