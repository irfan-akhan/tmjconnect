/**
 * Reusable symptom log queries.
 *
 * Ownership: every read/update uses `scopeToUser()` so PHI never leaks across
 * patients. The helper injects `WHERE patient_id = user.id` for role=patient;
 * admin routes (which bypass this file) are not expected to hit these queries.
 *
 * Upsert strategy: check for an existing log on the same calendar day,
 * then UPDATE or INSERT. This avoids the complexity of Drizzle's
 * expression-based ON CONFLICT targets.
 *
 * The same-day edit window is enforced by the DB trigger `enforce_symptom_edit_window`
 * (updated in migration 0009). Any UPDATE on a log created before CURRENT_DATE raises
 * a PostgreSQL exception (P0001) which the global error handler converts to 400.
 */
import { eq, and, lt, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { symptomLogs } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type SymptomLogData = {
  pain_level: number;
  pain_types: string[];
  body_areas: unknown;
  duration_minutes?: number | null;
  triggers: string[];
  notes?: string | null;
  logged_at: Date;
};

// ─── Upsert ────────────────────────────────────────────────────────────────────────

/**
 * upsertSymptomLog — Create a new log or update the existing log for the same day.
 *
 * "Same day" is evaluated in UTC (consistent with DB DATE() calls).
 * Returns the resulting row and a `created` boolean.
 */
export async function upsertSymptomLog(
  db: Db['db'],
  user: ScopedUser,
  data: SymptomLogData,
): Promise<{ log: typeof symptomLogs.$inferSelect; created: boolean }> {
  return db.transaction(async (tx) => {
    // Lock the row (if it exists) so concurrent requests for the same day
    // are serialised rather than both passing the check and racing to INSERT.
    const [existing] = await tx
      .select({ id: symptomLogs.id })
      .from(symptomLogs)
      .where(
        scopeToUser(
          sql`DATE(${symptomLogs.logged_at}) = DATE(${data.logged_at.toISOString()}::timestamptz)`,
          symptomLogs,
          user,
        ),
      )
      .for('update')
      .limit(1);

    if (existing) {
      // UPDATE path — DB trigger enforces the same-day edit window.
      const [updated] = await tx
        .update(symptomLogs)
        .set({
          pain_level: data.pain_level,
          pain_types: data.pain_types,
          body_areas: data.body_areas as Record<string, unknown>[],
          duration_minutes: data.duration_minutes ?? null,
          triggers: data.triggers,
          notes: data.notes ?? null,
          logged_at: data.logged_at,
          updated_at: sql`NOW()`,
        })
        .where(scopeToUser(eq(symptomLogs.id, existing.id), symptomLogs, user))
        .returning();
      return { log: updated, created: false };
    }

    // INSERT path.
    const [created] = await tx
      .insert(symptomLogs)
      .values({
        patient_id: user.id,
        pain_level: data.pain_level,
        pain_types: data.pain_types,
        body_areas: data.body_areas as Record<string, unknown>[],
        duration_minutes: data.duration_minutes ?? null,
        triggers: data.triggers,
        notes: data.notes ?? null,
        logged_at: data.logged_at,
      })
      .returning();
    return { log: created, created: true };
  });
}

// ─── Read ──────────────────────────────────────────────────────────────────────────

/**
 * listSymptomLogs — Cursor-paginated list (descending by logged_at).
 * Fetches `limit + 1` rows so the caller can determine hasMore.
 */
export async function listSymptomLogs(
  db: Db['db'],
  user: ScopedUser,
  cursor: Date | null,
  limit: number,
) {
  const baseCondition = cursor ? lt(symptomLogs.logged_at, cursor) : undefined;
  return db
    .select()
    .from(symptomLogs)
    .where(scopeToUser(baseCondition, symptomLogs, user))
    .orderBy(desc(symptomLogs.logged_at))
    .limit(limit + 1); // extra row used by buildCursorMeta to detect hasMore
}

/**
 * Lightweight stats for the patient dashboard — no row-level detail, just
 * aggregates. Returns null `first_logged_at` when the patient has never
 * logged.
 */
export async function getSymptomStats(db: Db['db'], user: ScopedUser) {
  const [row] = await db
    .select({
      first_logged_at: sql<Date | null>`MIN(${symptomLogs.logged_at})`,
      total_count: sql<string>`COUNT(*)::text`,
    })
    .from(symptomLogs)
    .where(scopeToUser(undefined, symptomLogs, user));
  return {
    first_logged_at: row?.first_logged_at ?? null,
    total_count: parseInt(row?.total_count ?? '0', 10),
  };
}

export async function getSymptomLogById(
  db: Db['db'],
  id: string,
  user: ScopedUser,
) {
  const [row] = await db
    .select()
    .from(symptomLogs)
    .where(scopeToUser(eq(symptomLogs.id, id), symptomLogs, user));
  return row ?? null;
}

/**
 * listSymptomLogsForPatient — Provider-facing read path.
 *
 * Use ONLY after `verifyProviderLink()` has confirmed the authenticated
 * provider is linked to the target patient. Per spec §3.9, the provider's
 * access to a linked patient's data is gated by link verification — NOT by
 * `scopeToUser()` (which would misfire for this cross-role query).
 */
export async function listSymptomLogsForPatient(
  db: Db['db'],
  patientId: string,
  cursor: Date | null,
  limit: number,
) {
  const baseCondition = cursor
    ? and(eq(symptomLogs.patient_id, patientId), lt(symptomLogs.logged_at, cursor))
    : eq(symptomLogs.patient_id, patientId);
  return db
    .select()
    .from(symptomLogs)
    .where(baseCondition)
    .orderBy(desc(symptomLogs.logged_at))
    .limit(limit + 1);
}

// ─── Edit ──────────────────────────────────────────────────────────────────────────

/**
 * updateSymptomLog — Partial update.
 * The same-day edit window is enforced by the DB trigger — any attempt to edit a
 * log created before today will raise a PostgreSQL exception.
 */
export async function updateSymptomLog(
  db: Db['db'],
  id: string,
  user: ScopedUser,
  data: Partial<SymptomLogData>,
) {
  const setFields: Record<string, unknown> = { updated_at: sql`NOW()` };

  if (data.pain_level !== undefined) setFields.pain_level = data.pain_level;
  if (data.pain_types !== undefined) setFields.pain_types = data.pain_types;
  if (data.body_areas !== undefined) setFields.body_areas = data.body_areas;
  if (data.duration_minutes !== undefined) setFields.duration_minutes = data.duration_minutes;
  if (data.triggers !== undefined) setFields.triggers = data.triggers;
  if (data.notes !== undefined) setFields.notes = data.notes;
  if (data.logged_at !== undefined) setFields.logged_at = data.logged_at;

  const [updated] = await db
    .update(symptomLogs)
    .set(setFields as Partial<typeof symptomLogs.$inferInsert>)
    .where(scopeToUser(eq(symptomLogs.id, id), symptomLogs, user))
    .returning();
  return updated ?? null;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────────

/**
 * getSymptomCalendar — Aggregate symptom logs by UTC calendar day for a given month.
 * Returns { day: 'YYYY-MM-DD', avg_pain: number, count: number }[] sorted by day ASC.
 *
 * Uses raw SQL for the aggregate — the `patient_id = :userId` filter is inlined
 * here (equivalent to scopeToUser for role=patient). If this query ever needs
 * to serve providers/admins, convert to the Drizzle builder + scopeToUser.
 */
export async function getSymptomCalendar(
  db: Db['db'],
  patientId: string,
  year: number,
  month: number,
) {
  type CalendarRow = { day: string; avg_pain: string; count: string };

  const result = await db.execute<CalendarRow>(sql`
    SELECT
      DATE(logged_at)::text                            AS day,
      ROUND(AVG(pain_level)::numeric, 1)::text         AS avg_pain,
      COUNT(*)::text                                   AS count
    FROM symptom_logs
    WHERE
      patient_id = ${patientId}
      AND EXTRACT(YEAR  FROM logged_at) = ${year}
      AND EXTRACT(MONTH FROM logged_at) = ${month}
    GROUP BY DATE(logged_at)
    ORDER BY day
  `);

  const rows: CalendarRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    day: r.day,
    avg_pain: parseFloat(r.avg_pain),
    count: parseInt(r.count, 10),
  }));
}
