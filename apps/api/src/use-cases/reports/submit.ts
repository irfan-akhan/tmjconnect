import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import {
  findIdempotencyKey,
  insertReport,
  insertReportWithIdempotencyKey,
} from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type SubmitReportInput = {
  patientId: string;
  idempotencyKey: string | null;
  provider_id: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level?: number | null;
  description: string;
  photo_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  patient_notes?: string | null;
};

export async function execute(deps: Deps, input: SubmitReportInput) {
  const { db, notify, logger } = deps;
  logger.debug(
    { patientId: input.patientId, providerId: input.provider_id, urgency: input.urgency, idempotencyKey: input.idempotencyKey ? 'present' : 'absent' },
    'submit-report: start',
  );

  // Idempotency check.
  if (input.idempotencyKey) {
    const existing = await findIdempotencyKey(db, input.idempotencyKey);
    if (existing) {
      if (new Date() > existing.expires_at) {
        logger.debug({ patientId: input.patientId }, 'submit-report: rejected — idempotency key expired');
        throw new AppError(409, 'IDEMPOTENCY_KEY_EXPIRED', 'This idempotency key has expired.');
      }
      logger.debug({ patientId: input.patientId }, 'submit-report: idempotent replay, returning cached response');
      return { report: existing.response_body, alreadyExists: true };
    }
  }

  // Verify patient is linked to the provider.
  const linked = await verifyProviderLink(db, input.provider_id, input.patientId);
  if (!linked) {
    logger.debug({ patientId: input.patientId, providerId: input.provider_id }, 'submit-report: rejected — not linked');
    throw new AppError(403, 'FORBIDDEN', 'You are not linked to this provider.');
  }
  logger.debug({ patientId: input.patientId, providerId: input.provider_id }, 'submit-report: link verified');

  const reportData = {
    patient_id: input.patientId,
    provider_id: input.provider_id,
    urgency: input.urgency,
    pain_level: input.pain_level,
    description: input.description,
    photo_url: input.photo_url,
    period_start: input.period_start ? new Date(input.period_start) : null,
    period_end: input.period_end ? new Date(input.period_end) : null,
    patient_notes: input.patient_notes,
  };

  // Atomic: insert report + idempotency key in one transaction.
  const report = input.idempotencyKey
    ? await insertReportWithIdempotencyKey(db, reportData, input.idempotencyKey)
    : await insertReport(db, reportData);
  logger.debug({ reportId: report.id, patientId: input.patientId, urgency: input.urgency }, 'submit-report: report inserted');

  // Notify provider (fire-and-forget).
  const notifType = input.urgency === 'urgent' ? 'report_urgent' as const : 'report_submitted' as const;
  notify.notify({
    userId: input.provider_id,
    type: notifType,
    title: input.urgency === 'urgent' ? 'Urgent report submitted' : 'New patient report',
    body: `A ${input.urgency} report has been submitted.`,
    data: { reportId: report.id, urgency: input.urgency, patientId: input.patientId },
  }).catch((err) => logger.warn({ err }, 'Report submission notification failed'));

  logger.debug({ reportId: report.id }, 'submit-report: complete');
  return { report, alreadyExists: false };
}
