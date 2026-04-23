import type { Container } from '../../config/container';
import { listNotifications, countUnread } from '../../db/queries/notifications.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type ListNotificationsInput = { user: ScopedUser; cursor: Date | null; limit: number };

export async function execute(deps: Deps, input: ListNotificationsInput) {
  const { db } = deps;
  const rows = await listNotifications(db, input.user, input.cursor, input.limit);
  const items = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;
  const unread_count = await countUnread(db, input.user);
  return { items, hasMore, unread_count };
}
