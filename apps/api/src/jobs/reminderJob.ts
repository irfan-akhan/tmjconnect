/**
 * reminderJob — Fires due reminders (every minute).
 *
 * Query: WHERE next_fire_at <= NOW() AND enabled = true
 * For each reminder:
 *   1. Send push notification via notify()
 *   2. Recalculate next_fire_at using computeNextFireAt()
 *   3. Update the reminder row
 */
import type { Container } from '../config/container';
import { sql, eq, and, lte } from 'drizzle-orm';
import { reminders, profiles } from '../db/schema';
import { computeNextFireAt } from '../utils/reminderTime';

export async function reminderJob(container: Container) {
  const { db, notify, logger } = container;

  const dueReminders = await db
    .select({
      id: reminders.id,
      user_id: reminders.user_id,
      type: reminders.type,
      time: reminders.time,
      days: reminders.days,
    })
    .from(reminders)
    .where(and(
      lte(reminders.next_fire_at, sql`NOW()`),
      eq(reminders.enabled, true),
    ));

  if (dueReminders.length === 0) return;

  logger.info({ count: dueReminders.length }, 'reminderJob: firing due reminders');

  for (const reminder of dueReminders) {
    try {
      // Look up user timezone for recalculation.
      const [profile] = await db
        .select({ timezone: profiles.timezone })
        .from(profiles)
        .where(eq(profiles.user_id, reminder.user_id))
        .limit(1);

      const timezone = profile?.timezone ?? 'America/Chicago';
      const days = (reminder.days as string[]) ?? ['mon', 'tue', 'wed', 'thu', 'fri'];

      // Fire notification.
      const title = reminder.type === 'exercise'
        ? 'Time for your exercises'
        : 'Time to log your symptoms';
      const body = reminder.type === 'exercise'
        ? 'Complete your assigned exercises to stay on track.'
        : 'Record how you are feeling today.';

      await notify.notify({
        userId: reminder.user_id,
        type: reminder.type === 'exercise' ? 'exercise_reminder' : 'symptom_checkin',
        title,
        body,
        data: { reminderId: reminder.id, type: reminder.type },
      });

      // Recalculate next fire time.
      const nextFireAt = computeNextFireAt(reminder.time, days, timezone);
      await db
        .update(reminders)
        .set({ next_fire_at: nextFireAt, updated_at: sql`NOW()` })
        .where(eq(reminders.id, reminder.id));
    } catch (err) {
      logger.error({ err, reminderId: reminder.id }, 'reminderJob: failed to fire reminder');
    }
  }
}
