import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  getReportForPatient,
  getReportResponsesForPatient,
  getReportForProvider,
  getReportResponsesForProvider,
  markReportViewed,
} from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type GetReportInput = {
  userId: string;
  role: 'patient' | 'provider';
  reportId: string;
};

export async function execute(deps: Deps, input: GetReportInput) {
  const { db } = deps;
  const user = { id: input.userId, role: input.role };

  if (input.role === 'patient') {
    const report = await getReportForPatient(db, input.reportId, user);
    if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');
    const responses = await getReportResponsesForPatient(db, input.reportId);
    return { report, responses };
  }

  // Provider path: includes internal_notes, auto-marks as viewed.
  let report = await getReportForProvider(db, input.reportId, user);
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

  if (report.status === 'submitted') {
    await markReportViewed(db, input.reportId);
    // Re-read to return the actual DB state.
    report = (await getReportForProvider(db, input.reportId, user))!;
  }

  const responses = await getReportResponsesForProvider(db, input.reportId);
  return { report, responses };
}
