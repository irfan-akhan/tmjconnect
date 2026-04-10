import type { Container } from '../../config/container';
import { listReminders } from '../../db/queries/reminders.queries';

type Deps = Pick<Container, 'db'>;

export type ListRemindersInput = { userId: string };

export async function execute(deps: Deps, input: ListRemindersInput) {
  return listReminders(deps.db, input.userId);
}
