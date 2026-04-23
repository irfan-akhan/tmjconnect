import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { listSymptomLogsForPatient } from '../../db/queries/symptoms.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientSymptomsInput = {
  providerId: string;
  patientId: string;
  cursor: Date | null;
  limit: number;
};

export type ListPatientSymptomsOutput = {
  items: Awaited<ReturnType<typeof listSymptomLogsForPatient>>;
  hasMore: boolean;
};

export async function execute(
  deps: Deps,
  input: ListPatientSymptomsInput,
): Promise<ListPatientSymptomsOutput> {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const rows = await listSymptomLogsForPatient(deps.db, input.patientId, input.cursor, input.limit);
  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
  };
}
