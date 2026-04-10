import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { markNotificationRead } from '../../db/queries/notifications.queries';

type Deps = Pick<Container, 'db'>;

export type MarkOneReadInput = { userId: string; notifId: string };

export async function execute(deps: Deps, input: MarkOneReadInput) {
  const updated = await markNotificationRead(deps.db, input.notifId, input.userId);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  return updated;
}
