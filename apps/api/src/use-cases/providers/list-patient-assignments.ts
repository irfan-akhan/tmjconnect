import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink, listPatientAssignments } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientAssignmentsInput = { providerId: string; patientId: string };

export async function execute(deps: Deps, input: ListPatientAssignmentsInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  return listPatientAssignments(deps.db, input.providerId, input.patientId);
}
