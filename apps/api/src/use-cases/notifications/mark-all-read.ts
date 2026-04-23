import type { Container } from '../../config/container';
import { markAllNotificationsRead } from '../../db/queries/notifications.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type MarkAllReadInput = { user: ScopedUser };

export async function execute(deps: Deps, input: MarkAllReadInput): Promise<void> {
  await markAllNotificationsRead(deps.db, input.user);
}
