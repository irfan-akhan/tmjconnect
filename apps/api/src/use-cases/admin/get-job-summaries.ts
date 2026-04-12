import type { Container } from '../../config/container';
import { getJobSummaries } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps) {
  return getJobSummaries(deps.db);
}
