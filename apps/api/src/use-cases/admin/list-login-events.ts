import type { Container } from '../../config/container';
import { listLoginEvents, countLoginEvents } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type ListLoginEventsInput = {
  page: number;
  limit: number;
  user_id?: string;
  success?: boolean;
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListLoginEventsInput) {
  const { page, limit, ...filters } = input;
  const [items, total] = await Promise.all([
    listLoginEvents(deps.db, page, limit, filters),
    countLoginEvents(deps.db, filters),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
