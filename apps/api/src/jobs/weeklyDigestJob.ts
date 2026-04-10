/**
 * weeklyDigestJob — Runs hourly (offset :05).
 *
 * Finds users where email_digest = 'weekly' AND next_digest_at <= NOW().
 * For each: compute 7-day stats, send via notify(), recalculate next_digest_at.
 */
import type { Container } from '../config/container';
import { sql, eq, and, lte, isNotNull } from 'drizzle-orm';
import {
  notificationPreferences,
  profiles,
  users,
} from '../db/schema';

type DigestRow = {
  user_id: string;
  timezone: string;
  avg_pain: string | null;
  exercises_completed: string | null;
  completion_rate: string | null;
  streak_days: string | null;
};

export async function weeklyDigestJob(container: Container) {
  const { db, notify, logger } = container;

  // Find users due for a weekly digest.
  const dueUsers = await db
    .select({
      user_id: notificationPreferences.user_id,
      timezone: profiles.timezone,
    })
    .from(notificationPreferences)
    .innerJoin(profiles, eq(profiles.user_id, notificationPreferences.user_id))
    .where(and(
      eq(notificationPreferences.email_digest, 'weekly'),
      lte(notificationPreferences.next_digest_at, sql`NOW()`),
      isNotNull(notificationPreferences.next_digest_at),
    ));

  if (dueUsers.length === 0) return;

  logger.info({ count: dueUsers.length }, 'weeklyDigestJob: sending digests');

  for (const user of dueUsers) {
    try {
      // Compute 7-day stats.
      const [stats] = await db.execute<DigestRow>(sql`
        SELECT
          ${user.user_id} AS user_id,
          ${user.timezone} AS timezone,
          (SELECT ROUND(AVG(pain_level)::numeric, 1)::text
           FROM symptom_logs WHERE patient_id = ${user.user_id}
           AND logged_at >= NOW() - INTERVAL '7 days') AS avg_pain,
          (SELECT COUNT(*)::text
           FROM exercise_completions WHERE patient_id = ${user.user_id}
           AND completed_at >= NOW() - INTERVAL '7 days') AS exercises_completed,
          (SELECT
            CASE WHEN COUNT(*) = 0 THEN '0'
            ELSE ROUND(
              COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric
              / GREATEST(COUNT(*), 1) * 100
            )::text END
           FROM exercise_assignments ea
           LEFT JOIN exercise_completions ec ON ec.assignment_id = ea.id
             AND ec.completed_at >= NOW() - INTERVAL '7 days'
           WHERE ea.patient_id = ${user.user_id} AND ea.status = 'active') AS completion_rate,
          '0' AS streak_days
      `).then((r) => {
        const rows = Array.isArray(r) ? r : r.rows ?? [];
        return rows;
      });

      await notify.notify({
        userId: user.user_id,
        type: 'weekly_summary',
        title: 'Your weekly summary is ready',
        body: 'Check out your progress this week.',
        data: {
          avgPainLevel: parseFloat(stats?.avg_pain ?? '0'),
          exercisesCompleted: parseInt(stats?.exercises_completed ?? '0', 10),
          completionRate: parseInt(stats?.completion_rate ?? '0', 10),
          streakDays: parseInt(stats?.streak_days ?? '0', 10),
        },
      });

      // Recalculate next_digest_at (7 days from now, same time).
      await db
        .update(notificationPreferences)
        .set({
          next_digest_at: sql`NOW() + INTERVAL '7 days'`,
          updated_at: sql`NOW()`,
        })
        .where(eq(notificationPreferences.user_id, user.user_id));
    } catch (err) {
      logger.error({ err, userId: user.user_id }, 'weeklyDigestJob: failed for user');
    }
  }
}
