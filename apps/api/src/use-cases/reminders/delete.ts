import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteReminder } from '../../db/queries/reminders.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type DeleteReminderInput = { user: ScopedUser; id: string };

export async function execute(deps: Deps, input: DeleteReminderInput): Promise<void> {
  const deleted = await deleteReminder(deps.db, input.id, input.user);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Reminder not found.');
}
