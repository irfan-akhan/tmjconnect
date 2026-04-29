import type { Container } from '../../config/container';
import { getProviderLinkingMetrics } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps, input: { providerId: string }) {
  return getProviderLinkingMetrics(deps.db, input.providerId);
}
