import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { insertClinicVisit } from '../../db/queries/clinic-visits.queries';

type Deps = Pick<Container, 'db'>;

export type RecordClinicVisitInput = {
  providerId: string;
  patientId: string;
  visited_at: string;
  notes?: string | null;
};

export async function execute(deps: Deps, input: RecordClinicVisitInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  return insertClinicVisit(deps.db, {
    patient_id: input.patientId,
    provider_id: input.providerId,
    visited_at: input.visited_at,
    notes: input.notes ?? null,
  });
}
