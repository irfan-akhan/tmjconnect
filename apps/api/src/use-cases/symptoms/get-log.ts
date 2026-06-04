import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getSymptomLogById } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetLogInput = { user: ScopedUser; id: string };

export async function execute(deps: Deps, input: GetLogInput) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(input.id)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid symptom log id.');
  }

  const log = await getSymptomLogById(deps.db, input.id, input.user);
  if (!log) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');
  return log;
}
