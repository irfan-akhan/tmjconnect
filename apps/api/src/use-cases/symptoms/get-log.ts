import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getSymptomLogById } from '../../db/queries/symptoms.queries';

type Deps = Pick<Container, 'db'>;

export type GetLogInput = { userId: string; id: string };

export async function execute(deps: Deps, input: GetLogInput) {
  const log = await getSymptomLogById(deps.db, input.id, input.userId);
  if (!log) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');
  return log;
}
