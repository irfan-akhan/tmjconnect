import type { Container } from '../../config/container';
import { listOutboxDlq, countOutboxDlq } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

type SortOrder = 'asc' | 'desc';

export type Input = {
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'next_attempt_at' | 'attempts';
  sortOrder?: SortOrder;
  channel?: string;
};

export async function execute(deps: Deps, input: Input) {
  const { limit, offset, sortBy, sortOrder = 'desc', channel } = input;
  const [items, total] = await Promise.all([
    listOutboxDlq(deps.db, limit, offset, channel, sortBy, sortOrder),
    countOutboxDlq(deps.db, channel),
  ]);
  return { items, meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder } };
}
