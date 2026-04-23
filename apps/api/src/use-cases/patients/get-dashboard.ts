import { sql, desc, eq } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { profiles, symptomLogs, exerciseAssignments, exerciseCompletions, notifications } from '../../db/schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps, input: { user: ScopedUser }) {
  const { db } = deps;
  const { user } = input;

  const [profile, todayLog, logDates, assignmentRows, notifRows, unreadRow] = await Promise.all([
    // 1. Profile
    db
      .select({
        first_name: profiles.first_name,
        last_name: profiles.last_name,
        avatar_url: profiles.avatar_url,
      })
      .from(profiles)
      .where(eq(profiles.user_id, user.id))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 2. Today's log
    db
      .select({
        id: symptomLogs.id,
        pain_level: symptomLogs.pain_level,
        pain_types: symptomLogs.pain_types,
        logged_at: symptomLogs.logged_at,
      })
      .from(symptomLogs)
      .where(
        scopeToUser(
          sql`DATE(${symptomLogs.logged_at}) = CURRENT_DATE`,
          symptomLogs,
          user,
        ),
      )
      .orderBy(desc(symptomLogs.logged_at))
      .limit(1)
      .then((r) => r[0] ?? null),

    // 3. Log dates (last 60 days) for streak computation
    db
      .select({ logged_at: symptomLogs.logged_at })
      .from(symptomLogs)
      .where(
        scopeToUser(
          sql`${symptomLogs.logged_at} >= NOW() - INTERVAL '60 days'`,
          symptomLogs,
          user,
        ),
      )
      .orderBy(desc(symptomLogs.logged_at)),

    // 4. Active assignments with completed_today
    db
      .select({
        assignment_id: exerciseAssignments.id,
        title: sql<string>`e.title`,
        category: sql<string>`e.category`,
        duration_seconds: sql<number>`e.duration_seconds`,
        frequency: exerciseAssignments.frequency,
        sets: exerciseAssignments.sets,
        status: exerciseAssignments.status,
        completed_today: sql<boolean>`EXISTS (
          SELECT 1 FROM ${exerciseCompletions}
          WHERE ${exerciseCompletions.assignment_id} = ${exerciseAssignments.id}
            AND DATE(${exerciseCompletions.completed_at}) = CURRENT_DATE
        )`,
      })
      .from(exerciseAssignments)
      .innerJoin(sql`exercises e`, sql`e.id = ${exerciseAssignments.exercise_id}`)
      .where(
        scopeToUser(
          eq(exerciseAssignments.status, 'active'),
          exerciseAssignments,
          user,
        ),
      ),

    // 5. Recent notifications (3)
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        read: notifications.read,
        created_at: notifications.created_at,
      })
      .from(notifications)
      .where(scopeToUser(undefined, notifications, user))
      .orderBy(desc(notifications.created_at))
      .limit(3),

    // 6. Unread count
    db
      .select({ count: sql<string>`COUNT(*)::text` })
      .from(notifications)
      .where(
        scopeToUser(eq(notifications.read, false), notifications, user),
      )
      .then((r) => parseInt(r[0]?.count ?? '0', 10)),
  ]);

  // Compute streaks server-side
  const streak = computeStreak(logDates.map((r) => r.logged_at.toISOString()));

  return {
    profile,
    today_log: todayLog,
    streak,
    assignments: assignmentRows,
    notifications: notifRows,
    unread_count: unreadRow,
  };
}

// ─── Streak logic (mirrored from mobile utils/streak.ts) ──────────────────

function computeStreak(timestamps: string[]): { streak: number; longest: number } {
  if (timestamps.length === 0) return { streak: 0, longest: 0 };

  const days = new Set<string>();
  for (const t of timestamps) days.add(ymd(new Date(t)));

  let longest = 0;
  for (const day of days) {
    const d = new Date(day);
    if (days.has(ymd(addDays(d, -1)))) continue;
    let run = 1;
    let cursor = d;
    while (days.has(ymd(addDays(cursor, 1)))) { run++; cursor = addDays(cursor, 1); }
    if (run > longest) longest = run;
  }

  const today = new Date();
  let currentStreak = 0;
  let cursor = today;
  if (!days.has(ymd(today))) cursor = addDays(today, -1);
  while (days.has(ymd(cursor))) { currentStreak++; cursor = addDays(cursor, -1); }

  return { streak: currentStreak, longest };
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}
