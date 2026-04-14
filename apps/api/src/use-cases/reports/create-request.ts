import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { insertRequest } from '../../db/queries/report-requests.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type CreateRequestInput = {
  providerId: string;
  patientId: string;
  prompt: string;
};

export async function execute(deps: Deps, input: CreateRequestInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const row = await insertRequest(deps.db, {
    provider_id: input.providerId,
    patient_id: input.patientId,
    prompt: input.prompt,
  });

  // Best-effort nudge to the patient. Uses the existing provider_message channel
  // since that's the closest semantic match — adding a dedicated notification
  // type would need a migration to extend the enum.
  try {
    await deps.notify.notify({
      userId: input.patientId,
      type: 'report_requested',
      title: 'Your provider requested a report',
      body: input.prompt.slice(0, 180),
      data: { request_id: row.id },
    });
  } catch (err) {
    deps.logger.warn({ err, request_id: row.id }, 'report_request notification failed');
  }

  return row;
}
