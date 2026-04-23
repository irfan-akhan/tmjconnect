import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { toggleReportFlag } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type FlagInput = { providerId: string; reportId: string };

export async function execute(deps: Deps, input: FlagInput) {
  const provider = { id: input.providerId, role: 'provider' as const };
  const result = await toggleReportFlag(deps.db, input.reportId, provider);
  if (!result) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
  return result;
}
