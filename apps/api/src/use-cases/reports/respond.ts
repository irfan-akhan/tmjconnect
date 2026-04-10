import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getReportForProvider, insertReportResponse } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type RespondInput = {
  providerId: string;
  reportId: string;
  message: string;
  internal_notes?: string | null;
};

export async function execute(deps: Deps, input: RespondInput) {
  const { db, notify, logger } = deps;

  const report = await getReportForProvider(db, input.reportId, input.providerId);
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

  const response = await insertReportResponse(
    db,
    input.reportId,
    input.providerId,
    input.message,
    input.internal_notes ?? null,
  );

  // Notify patient that their report received a response.
  // Uses report_reviewed type (same channel routing) with distinct title/body
  // so the patient can differentiate a comment from a formal review.
  notify.notify({
    userId: report.patient_id,
    type: 'report_reviewed',
    title: 'New message from your provider',
    body: 'Your provider has left a response on your health report.',
    data: { reportId: report.id, action: 'responded' },
  }).catch((err) => logger.warn({ err }, 'Report response notification failed'));

  return response;
}
