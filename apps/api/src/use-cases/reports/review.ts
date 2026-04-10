import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getReportForProvider, markReportReviewed } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type ReviewInput = { providerId: string; reportId: string };

export async function execute(deps: Deps, input: ReviewInput) {
  const { db, notify, logger } = deps;

  const report = await getReportForProvider(db, input.reportId, input.providerId);
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

  await markReportReviewed(db, input.reportId);

  notify.notify({
    userId: report.patient_id,
    type: 'report_reviewed',
    title: 'Your report has been reviewed',
    body: 'Your provider has reviewed your health report.',
    data: { reportId: report.id },
  }).catch((err) => logger.warn({ err }, 'Report review notification failed'));
}
