import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink, getPatientDetail } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type GetPatientDetailInput = { providerId: string; patientId: string };

export async function execute(deps: Deps, input: GetPatientDetailInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const patient = await getPatientDetail(deps.db, input.patientId);
  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');
  return patient;
}
