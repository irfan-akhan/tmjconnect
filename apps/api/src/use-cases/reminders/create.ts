import type { Container } from '../../config/container';
import { insertReminder, getUserTimezone } from '../../db/queries/reminders.queries';
import { computeNextFireAt } from '../../utils/reminderTime';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type CreateReminderInput = {
  user: ScopedUser;
  type: 'exercise' | 'symptom';
  time: string;
  days: string[];
  enabled: boolean;
};

export async function execute(deps: Deps, input: CreateReminderInput) {
  const { db } = deps;
  const timezone = await getUserTimezone(db, input.user.id);
  const next_fire_at = computeNextFireAt(input.time, input.days, timezone);
  return insertReminder(db, {
    user_id: input.user.id,
    type: input.type,
    time: input.time,
    days: input.days,
    enabled: input.enabled,
    next_fire_at,
  });
}
