import type { Container } from '../../config/container';
import { getProviderAnalytics, type ProviderAnalytics } from '../../db/queries/provider-analytics.queries';

type Deps = Pick<Container, 'db'>;

export type GetAnalyticsInput = { providerId: string; days: number };

export async function execute(deps: Deps, input: GetAnalyticsInput): Promise<ProviderAnalytics> {
  return getProviderAnalytics(deps.db, input.providerId, input.days);
}
