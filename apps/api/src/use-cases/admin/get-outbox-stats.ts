import type { Container } from '../../config/container';
import { getOutboxStats } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps) {
  return getOutboxStats(deps.db);
}
