import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  verifyProviderLink,
  updatePatientLinkMeta,
  getPatientDetail,
} from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type UpdatePatientLinkInput = {
  providerId: string;
  patientId: string;
  fields: { diagnosis?: string | null };
};

export async function execute(deps: Deps, input: UpdatePatientLinkInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const ok = await updatePatientLinkMeta(
    deps.db,
    input.providerId,
    input.patientId,
    input.fields,
  );
  if (!ok) throw new AppError(404, 'NOT_FOUND', 'Active link not found.');

  // Returning the freshly-computed detail keeps the client's cache aligned in
  // one round trip.
  const detail = await getPatientDetail(deps.db, input.providerId, input.patientId);
  if (!detail) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');
  return detail;
}
