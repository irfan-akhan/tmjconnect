import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { insertNote } from '../../db/queries/clinical-notes.queries';

type Deps = Pick<Container, 'db'>;

export type CreateNoteInput = {
  providerId: string;
  patientId: string;
  body: string;
  tags: string[];
};

export async function execute(deps: Deps, input: CreateNoteInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  return insertNote(deps.db, {
    patient_id: input.patientId,
    provider_id: input.providerId,
    body: input.body,
    tags: input.tags,
  });
}
