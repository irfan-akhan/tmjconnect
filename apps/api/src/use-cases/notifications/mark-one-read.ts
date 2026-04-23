import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { markNotificationRead } from '../../db/queries/notifications.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type MarkOneReadInput = { user: ScopedUser; notifId: string };

export async function execute(deps: Deps, input: MarkOneReadInput) {
  const updated = await markNotificationRead(deps.db, input.notifId, input.user);
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Notification not found.');
  return updated;
}
