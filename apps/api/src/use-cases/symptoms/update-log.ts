import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { updateSymptomLog } from '../../db/queries/symptoms.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateLogInput = {
  userId: string;
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
  const { userId, id, logged_at, ...rest } = input;
  const data = {
    ...rest,
    ...(logged_at !== undefined && { logged_at: new Date(logged_at) }),
  };
  const updated = await updateSymptomLog(deps.db, id, userId, data);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Symptom log not found.');
  return updated;
}
