import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink, listPatientAssignments } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientAssignmentsInput = {
  providerId: string;
  patientId: string;
  limit?: number;
  offset?: number;
};

export async function execute(deps: Deps, input: ListPatientAssignmentsInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  const items = await listPatientAssignments(deps.db, input.providerId, input.patientId, limit, offset);
  return { items, meta: { limit, offset, hasMore: items.length === limit } };
}
