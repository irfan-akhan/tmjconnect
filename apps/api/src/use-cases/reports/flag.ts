import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { toggleReportFlag } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type FlagInput = { providerId: string; reportId: string };

export async function execute(deps: Deps, input: FlagInput) {
  const result = await toggleReportFlag(deps.db, input.reportId, input.providerId);
  if (!result) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
  return result;
}
