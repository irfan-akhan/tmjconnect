import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getSymptomLogById, updateSymptomLog } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type UpdateLogInput = {
  user: ScopedUser;
  id: string;
  pain_level?: number;
  pain_types?: string[];
  body_areas?: unknown;
  duration_minutes?: number | null;
  triggers?: string[];
  notes?: string | null;
  logged_at?: string;
};

export async function execute(deps: Deps, input: UpdateLogInput) {
  const { user, id, logged_at, ...rest } = input;

  const existing = await getSymptomLogById(deps.db, id, user);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');

  const createdDate = new Date(existing.created_at).toISOString().slice(0, 10);
  const todayDate = new Date().toISOString().slice(0, 10);
  if (createdDate !== todayDate) {
    throw new AppError(403, 'EDIT_WINDOW_CLOSED', 'Symptom logs can only be edited on the day they were created.');
  }

  const data = {
    ...rest,
    ...(logged_at !== undefined && { logged_at: new Date(logged_at) }),
  };
  const updated = await updateSymptomLog(deps.db, id, user, data);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');
  return updated;
}
