import type { Container } from '../../config/container';
import { getPlatformAnalytics, type PlatformAnalytics } from '../../db/queries/admin-analytics.queries';

type Deps = Pick<Container, 'db'>;

export type GetPlatformAnalyticsInput = { days: number };

export async function execute(deps: Deps, input: GetPlatformAnalyticsInput): Promise<PlatformAnalytics> {
  return getPlatformAnalytics(deps.db, input.days);
}