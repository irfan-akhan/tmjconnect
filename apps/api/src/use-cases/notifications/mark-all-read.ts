import type { Container } from '../../config/container';
import { markAllNotificationsRead } from '../../db/queries/notifications.queries';

type Deps = Pick<Container, 'db'>;

export type MarkAllReadInput = { userId: string };

export async function execute(deps: Deps, input: MarkAllReadInput): Promise<void> {
  await markAllNotificationsRead(deps.db, input.userId);
}
