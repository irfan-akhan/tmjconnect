import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { listNotesForPatient, countNotesForPatient } from '../../db/queries/clinical-notes.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientNotesInput = {
  providerId: string;
  patientId: string;
  page: number;
  limit: number;
};

export async function execute(deps: Deps, input: ListPatientNotesInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const provider = { id: input.providerId, role: 'provider' as const };
  const [items, total] = await Promise.all([
    listNotesForPatient(deps.db, input.patientId, provider, input.page, input.limit),
    countNotesForPatient(deps.db, input.patientId, input.providerId),
  ]);
  return {
    items,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
  };
}
