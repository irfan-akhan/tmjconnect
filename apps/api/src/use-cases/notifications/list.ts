import type { Container } from '../../config/container';
import { listNotifications, countUnread } from '../../db/queries/notifications.queries';

type Deps = Pick<Container, 'db'>;

export type ListNotificationsInput = { userId: string; cursor: Date | null; limit: number };

export async function execute(deps: Deps, input: ListNotificationsInput) {
  const { db } = deps;
  const rows = await listNotifications(db, input.userId, input.cursor, input.limit);
  const items = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const unread_count = await countUnread(db, input.userId);
  return { items, hasMore, unread_count };
}
