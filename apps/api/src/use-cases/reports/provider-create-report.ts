import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { insertReport } from '../../db/queries/reports.queries';
import { fulfillRequest } from '../../db/queries/report-requests.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type ProviderCreateReportInput = {
  providerId: string;
  patientId: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level?: number | null;
  description: string;
  photo_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  patient_notes?: string | null;
  /** Optional: fulfill an outstanding report request when filing this report. */
  fulfilling_request_id?: string;
};

export async function execute(deps: Deps, input: ProviderCreateReportInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const report = await insertReport(deps.db, {
    patient_id: input.patientId,
    provider_id: input.providerId,
    urgency: input.urgency,
    pain_level: input.pain_level ?? null,
    description: input.description,
    photo_url: input.photo_url ?? null,
    period_start: input.period_start ?? null,
    period_end: input.period_end ?? null,
    patient_notes: input.patient_notes ?? null,
    // Provenance — flags this row as provider-authored on the patient's behalf.
    authored_by_user_id: input.providerId,
    authored_by_role: 'provider',
  });

  if (input.fulfilling_request_id) {
    await fulfillRequest(deps.db, input.fulfilling_request_id, report.id);
  }

  // Best-effort: let the patient know a report was filed for them. Audit
  // trail is already in place via auditLog('report_created_on_behalf').
  try {
    await deps.notify.notify({
      userId: input.patientId,
      type: 'provider_message',
      title: 'Your provider filed a report on your behalf',
      body: input.description.slice(0, 180),
      data: { report_id: report.id, kind: 'on_behalf_of' },
    });
  } catch (err) {
    deps.logger.warn({ err, report_id: report.id }, 'on_behalf_of notification failed');
  }

  return report;
}
