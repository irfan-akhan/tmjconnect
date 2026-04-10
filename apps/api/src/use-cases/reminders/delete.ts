import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { deleteReminder } from '../../db/queries/reminders.queries';

type Deps = Pick<Container, 'db'>;

export type DeleteReminderInput = { userId: string; id: string };

export async function execute(deps: Deps, input: DeleteReminderInput): Promise<void> {
  const deleted = await deleteReminder(deps.db, input.id, input.userId);
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Reminder not found.');
}
