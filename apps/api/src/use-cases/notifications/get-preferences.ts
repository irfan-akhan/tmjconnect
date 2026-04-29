import type { Container } from '../../config/container';
import { getOrCreatePreferences } from '../../db/queries/notification-preferences.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps, input: { userId: string }) {
  return getOrCreatePreferences(deps.db, input.userId);
}
