import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';

type DbClient = Db['db'];

export type PatientAnalytics = {
  pain_trend: Array<{ date: string; pain_level: number }>;
  pain_summary: { avg_pain: number; min_pain: number; max_pain: number; total_logs: number };
  trigger_frequency: Array<{ trigger: string; count: number }>;
  exercise_compliance: { completed: number; assigned: number; rate: number };
  body_area_frequency: Array<{ area: string; count: number }>;
  day_of_week: Array<{ day: string; avg_pain: number }>;
};

export async function getPatientAnalytics(
  db: DbClient,
  providerId: string,
  patientId: string,
  days: number,
): Promise<PatientAnalytics> {
  // Verify link exists
  type LinkRow = { cnt: string };
  const linkRes = await db.execute<LinkRow>(sql`
    SELECT COUNT(*)::text AS cnt FROM patient_provider_links
    WHERE provider_id = ${providerId} AND patient_id = ${patientId} AND unlinked_at IS NULL
  `);
  const linkRows = Array.isArray(linkRes) ? linkRes : (linkRes as { rows?: LinkRow[] }).rows ?? [];
  if (parseInt(linkRows[0]?.cnt ?? '0', 10) === 0) {
    throw Object.assign(new Error('Patient not linked'), { statusCode: 404 });
  }

  const [painTrend, painSummary, triggers, compliance, bodyAreas, dow] = await Promise.all([
    getPainTrend(db, patientId, days),
    getPainSummary(db, patientId, days),
    getTriggerFrequency(db, patientId, days),
    getExerciseCompliance(db, patientId, days),
    getBodyAreaFrequency(db, patientId, days),
    getDayOfWeek(db, patientId, days),
  ]);

  return {
    pain_trend: painTrend,
    pain_summary: painSummary,
    trigger_frequency: triggers,
    exercise_compliance: compliance,
    body_area_frequency: bodyAreas,
    day_of_week: dow,
  };
}

async function getPainTrend(db: DbClient, patientId: string, days: number) {
  type Row = { date: string; pain_level: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(logged_at)::text AS date, ROUND(AVG(pain_level)::numeric, 1)::text AS pain_level
    FROM symptom_logs WHERE patient_id = ${patientId} AND logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(logged_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ date: r.date, pain_level: parseFloat(r.pain_level) }));
}

async function getPainSummary(db: DbClient, patientId: string, days: number) {
  type Row = { avg_pain: string; min_pain: string; max_pain: string; total_logs: string };
  const res = await db.execute<Row>(sql`
    SELECT ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
           MIN(pain_level)::text AS min_pain, MAX(pain_level)::text AS max_pain,
           COUNT(*)::text AS total_logs
    FROM symptom_logs WHERE patient_id = ${patientId} AND logged_at >= NOW() - (${days} || ' days')::interval
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  return {
    avg_pain: parseFloat(r?.avg_pain ?? '0'),
    min_pain: parseInt(r?.min_pain ?? '0', 10),
    max_pain: parseInt(r?.max_pain ?? '0', 10),
    total_logs: parseInt(r?.total_logs ?? '0', 10),
  };
}

async function getTriggerFrequency(db: DbClient, patientId: string, days: number) {
  type Row = { trigger: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT t.trigger, COUNT(*)::text AS count
    FROM symptom_logs sl, LATERAL unnest(sl.triggers) AS t(trigger)
    WHERE sl.patient_id = ${patientId} AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY t.trigger ORDER BY count DESC LIMIT 8
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ trigger: r.trigger, count: parseInt(r.count, 10) }));
}

async function getExerciseCompliance(db: DbClient, patientId: string, days: number) {
  type Row = { completed: string; assigned: string };
  const res = await db.execute<Row>(sql`
    SELECT
      (SELECT COUNT(*) FROM exercise_completions ec
       JOIN exercise_assignments ea ON ea.id = ec.assignment_id
       WHERE ea.patient_id = ${patientId} AND ec.completed_at >= NOW() - (${days} || ' days')::interval)::text AS completed,
      (SELECT COUNT(*) FROM exercise_assignments WHERE patient_id = ${patientId} AND status = 'active')::text AS assigned
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  const completed = parseInt(r?.completed ?? '0', 10);
  const assigned = parseInt(r?.assigned ?? '1', 10);
  return { completed, assigned, rate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0 };
}

async function getBodyAreaFrequency(db: DbClient, patientId: string, days: number) {
  type Row = { area: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT ba->>'area' AS area, COUNT(*)::text AS count
    FROM symptom_logs sl, LATERAL jsonb_array_elements(to_jsonb(sl.body_areas)) AS ba
    WHERE sl.patient_id = ${patientId} AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY ba->>'area' ORDER BY count DESC LIMIT 8
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ area: r.area, count: parseInt(r.count, 10) }));
}

async function getDayOfWeek(db: DbClient, patientId: string, days: number) {
  type Row = { day_name: string; avg_pain: string; dow: string };
  const res = await db.execute<Row>(sql`
    SELECT TO_CHAR(logged_at, 'Dy') AS day_name, EXTRACT(DOW FROM logged_at)::text AS dow,
           ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain
    FROM symptom_logs WHERE patient_id = ${patientId} AND logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY TO_CHAR(logged_at, 'Dy'), EXTRACT(DOW FROM logged_at) ORDER BY dow
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ day: r.day_name, avg_pain: parseFloat(r.avg_pain) }));
}
