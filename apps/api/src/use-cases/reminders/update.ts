import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findReminder, updateReminder, getUserTimezone } from '../../db/queries/reminders.queries';
import { computeNextFireAt } from '../../utils/reminderTime';

type Deps = Pick<Container, 'db'>;

export type UpdateReminderInput = {
  userId: string;
  id: string;
  type?: string;
  time?: string;
  days?: string[];
  enabled?: boolean;
};

export async function execute(deps: Deps, input: UpdateReminderInput) {
  const { db } = deps;
  const { userId, id, ...body } = input;

  const existing = await findReminder(db, id, userId);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Reminder not found.');

  const updateFields: Record<string, unknown> = { ...body };

  const scheduleChanged =
    body.time !== undefined ||
    body.days !== undefined ||
    (body.enabled !== undefined && body.enabled !== existing.enabled);

  if (scheduleChanged) {
    const newTime = body.time ?? existing.time;
    const newDays = (body.days ?? existing.days) as string[];
    const newEnabled = body.enabled ?? existing.enabled;

    if (newEnabled) {
      const timezone = await getUserTimezone(db, userId);
      updateFields.next_fire_at = computeNextFireAt(newTime, newDays, timezone);
    } else {
      updateFields.next_fire_at = null;
    }
  }

  return updateReminder(db, id, updateFields as Parameters<typeof updateReminder>[2]);
}
