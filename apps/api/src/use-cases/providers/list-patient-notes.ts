import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { listNotesForPatient, countNotesForPatient } from '../../db/queries/clinical-notes.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ListPatientNotesInput = {
  providerId: string;
  patientId: string;
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: SortOrder;
};

export async function execute(deps: Deps, input: ListPatientNotesInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const provider = { id: input.providerId, role: 'provider' as const };
  const [items, total] = await Promise.all([
    listNotesForPatient(deps.db, input.patientId, provider, input.limit, input.offset, input.sortBy, input.sortOrder),
    countNotesForPatient(deps.db, input.patientId, input.providerId),
  ]);
  return {
    items,
    meta: { limit: input.limit, offset: input.offset, total, hasMore: input.offset + input.limit < total, sortBy: input.sortBy, sortOrder: input.sortOrder ?? 'desc' },
  };
}
