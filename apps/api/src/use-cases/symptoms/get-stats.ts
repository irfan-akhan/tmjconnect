import type { Container } from '../../config/container';
import { getSymptomStats } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetStatsInput = { user: ScopedUser };

export async function execute(deps: Deps, input: GetStatsInput) {
  const row = await getSymptomStats(deps.db, input.user);
  return {
    first_logged_at: row.first_logged_at
      ? new Date(row.first_logged_at).toISOString()
      : null,
    total_count: row.total_count,
  };
}
