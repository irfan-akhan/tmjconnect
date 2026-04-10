import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getPatientWithProfile } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type GetProfileInput = { userId: string };

export async function execute(deps: Deps, input: GetProfileInput) {
  const patient = await getPatientWithProfile(deps.db, input.userId);
  if (!patient) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');
  return patient;
}
