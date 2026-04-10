import type { Container } from '../../config/container';
import { getAdminStats } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps) {
  return getAdminStats(deps.db);
}
