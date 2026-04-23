import { eq, desc, lt, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { jawMobilityLogs, medicationLogs, sleepLogs } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

// ─── Jaw Mobility ──────────────────────────────────────────────────────────

export async function createMobilityLog(
  db: Db['db'],
  user: ScopedUser,
  data: { measurement_mm: number; method?: string; notes?: string | null },
) {
  const [row] = await db
    .insert(jawMobilityLogs)
    .values({ patient_id: user.id, ...data })
    .returning();
  return row;
}

export async function listMobilityLogs(
  db: Db['db'],
  user: ScopedUser,
  cursor: Date | null,
  limit: number,
) {
  const base = cursor ? lt(jawMobilityLogs.logged_at, cursor) : undefined;
  return db
    .select()
    .from(jawMobilityLogs)
    .where(scopeToUser(base, jawMobilityLogs, user))
    .orderBy(desc(jawMobilityLogs.logged_at))
    .limit(limit + 1);
}

export async function getMobilityTrend(db: Db['db'], patientId: string, days: number) {
  type Row = { date: string; avg_mm: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(logged_at)::text AS date,
           ROUND(AVG(measurement_mm)::numeric, 0)::text AS avg_mm,
           COUNT(*)::text AS count
    FROM jaw_mobility_logs
    WHERE patient_id = ${patientId}
      AND logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(logged_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    date: r.date,
    avg_mm: parseInt(r.avg_mm, 10),
    count: parseInt(r.count, 10),
  }));
}

// ─── Medications ───────────────────────────────────────────────────────────

export async function createMedicationLog(
  db: Db['db'],
  user: ScopedUser,
  data: { medication_name: string; dosage?: string | null; notes?: string | null },
) {
  const [row] = await db
    .insert(medicationLogs)
    .values({ patient_id: user.id, ...data })
    .returning();
  return row;
}

export async function listMedicationLogs(
  db: Db['db'],
  user: ScopedUser,
  cursor: Date | null,
  limit: number,
) {
  const base = cursor ? lt(medicationLogs.logged_at, cursor) : undefined;
  return db
    .select()
    .from(medicationLogs)
    .where(scopeToUser(base, medicationLogs, user))
    .orderBy(desc(medicationLogs.logged_at))
    .limit(limit + 1);
}

export async function getMedicationCorrelation(db: Db['db'], patientId: string, days: number) {
  type Row = { medicated: string; avg_pain: string; day_count: string };
  const res = await db.execute<Row>(sql`
    WITH daily_pain AS (
      SELECT DATE(logged_at) AS d, ROUND(AVG(pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(logged_at)
    ),
    med_days AS (
      SELECT DISTINCT DATE(logged_at) AS d
      FROM medication_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
    )
    SELECT
      CASE WHEN md.d IS NOT NULL THEN 'yes' ELSE 'no' END AS medicated,
      ROUND(AVG(dp.avg_pain)::numeric, 1)::text AS avg_pain,
      COUNT(*)::text AS day_count
    FROM daily_pain dp
    LEFT JOIN med_days md ON md.d = dp.d
    GROUP BY CASE WHEN md.d IS NOT NULL THEN 'yes' ELSE 'no' END
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const yes = rows.find((r) => r.medicated === 'yes');
  const no = rows.find((r) => r.medicated === 'no');
  return {
    medication_days_avg_pain: parseFloat(yes?.avg_pain ?? '0'),
    medication_days_count: parseInt(yes?.day_count ?? '0', 10),
    no_medication_days_avg_pain: parseFloat(no?.avg_pain ?? '0'),
    no_medication_days_count: parseInt(no?.day_count ?? '0', 10),
  };
}

// ─── Sleep ─────────────────────────────────────────────────────────────────

export async function createSleepLog(
  db: Db['db'],
  user: ScopedUser,
  data: {
    quality: number;
    hours_slept?: string | null;
    bruxism_aware?: boolean;
    morning_stiffness?: number | null;
    notes?: string | null;
  },
) {
  const [row] = await db
    .insert(sleepLogs)
    .values({ patient_id: user.id, ...data })
    .returning();
  return row;
}

export async function listSleepLogs(
  db: Db['db'],
  user: ScopedUser,
  cursor: Date | null,
  limit: number,
) {
  const base = cursor ? lt(sleepLogs.logged_at, cursor) : undefined;
  return db
    .select()
    .from(sleepLogs)
    .where(scopeToUser(base, sleepLogs, user))
    .orderBy(desc(sleepLogs.logged_at))
    .limit(limit + 1);
}

export async function getSleepCorrelation(db: Db['db'], patientId: string, days: number) {
  type Row = { quality_bucket: string; avg_pain: string; day_count: string };
  const res = await db.execute<Row>(sql`
    WITH daily_sleep AS (
      SELECT DATE(logged_at) AS d, ROUND(AVG(quality)::numeric, 0) AS avg_quality
      FROM sleep_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(logged_at)
    ),
    daily_pain AS (
      SELECT DATE(logged_at) AS d, ROUND(AVG(pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(logged_at)
    )
    SELECT
      CASE WHEN ds.avg_quality >= 4 THEN 'good' WHEN ds.avg_quality >= 2 THEN 'fair' ELSE 'poor' END AS quality_bucket,
      ROUND(AVG(dp.avg_pain)::numeric, 1)::text AS avg_pain,
      COUNT(*)::text AS day_count
    FROM daily_pain dp
    JOIN daily_sleep ds ON ds.d = dp.d
    GROUP BY CASE WHEN ds.avg_quality >= 4 THEN 'good' WHEN ds.avg_quality >= 2 THEN 'fair' ELSE 'poor' END
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    quality: r.quality_bucket,
    avg_pain: parseFloat(r.avg_pain),
    days: parseInt(r.day_count, 10),
  }));
}
