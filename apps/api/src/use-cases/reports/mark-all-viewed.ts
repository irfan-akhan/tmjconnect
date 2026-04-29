import type { Container } from '../../config/container';
import { markAllReportsViewedForProvider } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type MarkAllViewedInput = {
  providerId: string;
};

export async function execute(deps: Deps, input: MarkAllViewedInput) {
  const updated = await markAllReportsViewedForProvider(deps.db, input.providerId);
  return { updated };
}
