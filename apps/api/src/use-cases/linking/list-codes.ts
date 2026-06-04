import type { Container } from '../../config/container';
import { listProviderCodes } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export type ListCodesInput = {
  providerId: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'expires_at' | 'status';
  sortOrder?: 'asc' | 'desc';
};

export async function execute(deps: Deps, input: ListCodesInput) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const sortOrder = input.sortOrder ?? 'desc';
  const items = await listProviderCodes(deps.db, input.providerId, limit, offset, input.sortBy, sortOrder);
  return { items, meta: { limit, offset, hasMore: items.length === limit, sortBy: input.sortBy, sortOrder } };
}
