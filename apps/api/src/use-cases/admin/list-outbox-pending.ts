import type { Container } from '../../config/container';
import { listOutboxPending, countOutboxPending } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type Input = { page: number; limit: number; channel?: string };

export async function execute(deps: Deps, input: Input) {
  const [items, total] = await Promise.all([
    listOutboxPending(deps.db, input.page, input.limit, input.channel),
    countOutboxPending(deps.db, input.channel),
  ]);
  return { items, meta: { page: input.page, limit: input.limit, total } };
}
