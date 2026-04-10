import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getNotificationPrefs } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type GetNotificationPrefsInput = { userId: string };

export async function execute(deps: Deps, input: GetNotificationPrefsInput) {
  const prefs = await getNotificationPrefs(deps.db, input.userId);
  if (!prefs) throw new AppError(404, 'NOT_FOUND', 'Preferences not found.');
  return prefs;
}
