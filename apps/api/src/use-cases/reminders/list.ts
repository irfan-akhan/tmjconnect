import type { Container } from '../../config/container';
import { listReminders } from '../../db/queries/reminders.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type ListRemindersInput = {
  user: ScopedUser;
  limit?: number;
  offset?: number;
  type?: string;
  enabled?: boolean;
};

export async function execute(deps: Deps, input: ListRemindersInput) {
  return listReminders(deps.db, input.user, {
    limit: input.limit,
    offset: input.offset,
    type: input.type,
    enabled: input.enabled,
  });
}
