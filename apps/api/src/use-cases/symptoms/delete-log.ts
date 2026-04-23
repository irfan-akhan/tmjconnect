import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getSymptomLogById } from '../../db/queries/symptoms.queries';
import { symptomLogs } from '../../db/schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';
import { eq } from 'drizzle-orm';

type Deps = Pick<Container, 'db'>;

export type DeleteLogInput = {
  user: ScopedUser;
  id: string;
};

export async function execute(deps: Deps, input: DeleteLogInput) {
  const existing = await getSymptomLogById(deps.db, input.id, input.user);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');

  const createdDate = new Date(existing.created_at).toISOString().slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  if (createdDate !== todayDate) {
    throw new AppError(403, 'EDIT_WINDOW_CLOSED', 'Symptom logs can only be deleted on the day they were created.');
  }

  await deps.db
    .delete(symptomLogs)
    .where(scopeToUser(eq(symptomLogs.id, input.id), symptomLogs, input.user));
}
