import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  getReportForPatient,
  getReportResponsesForPatient,
  getReportForProvider,
  getReportWithPatientForProvider,
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

  // Provider path: includes internal_notes, auto-marks as viewed, joins
  // patient profile so the detail view can render name + initials.
  // Use the lighter (no-join) read for the existence check + status update,
  // then re-read with the join to return.
  const ownership = await getReportForProvider(db, input.reportId, user);
  if (!ownership) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

  if (ownership.status === 'submitted') {
    await markReportViewed(db, input.reportId);
  }

  const report = await getReportWithPatientForProvider(db, input.reportId, user);
  if (!report) throw new AppError(404, 'NOT_FOUND', 'Report not found.');

  const responses = await getReportResponsesForProvider(db, input.reportId);
  return { report, responses };
}
