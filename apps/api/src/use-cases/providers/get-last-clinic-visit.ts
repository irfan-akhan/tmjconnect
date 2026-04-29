import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { getLastClinicVisitForPatient } from '../../db/queries/clinic-visits.queries';

type Deps = Pick<Container, 'db'>;

export type GetLastClinicVisitInput = {
  providerId: string;
  patientId: string;
};

export async function execute(deps: Deps, input: GetLastClinicVisitInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');
  return getLastClinicVisitForPatient(deps.db, input.patientId);
}
