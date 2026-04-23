import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';

type DbClient = Db['db'];

export type ProviderAnalytics = {
  overview: {
    total_patients: number;
    active_patients_7d: number;
    avg_pain_level: number;
    avg_pain_trend: number;
    total_logs_30d: number;
    exercise_compliance_pct: number;
  };
  pain_trend: Array<{ date: string; avg_pain: number; log_count: number }>;
  trigger_distribution: Array<{ trigger: string; count: number; pct: number }>;
  patient_engagement: Array<{
    patient_id: string;
    first_name: string;
    last_name: string;
    logs_30d: number;
    avg_pain: number;
    pain_delta: number;
    last_log_at: string | null;
    exercises_completed_30d: number;
  }>;
  pain_distribution: Array<{ level: number; count: number }>;
  exercise_impact: {
    with_exercise_avg_pain: number;
    without_exercise_avg_pain: number;
    with_exercise_days: number;
    without_exercise_days: number;
  };
  day_of_week_pattern: Array<{ day: string; avg_pain: number; log_count: number }>;
};

export async function getProviderAnalytics(
  db: DbClient,
  providerId: string,
  days: number,
): Promise<ProviderAnalytics> {
  const [
    overview,
    painTrend,
    triggerDist,
    patientEngagement,
    painDist,
    exerciseImpact,
    dowPattern,
  ] = await Promise.all([
    getOverview(db, providerId, days),
    getPainTrend(db, providerId, days),
    getTriggerDistribution(db, providerId, days),
    getPatientEngagement(db, providerId, days),
    getPainDistribution(db, providerId, days),
    getExerciseImpact(db, providerId, days),
    getDayOfWeekPattern(db, providerId, days),
  ]);

  return {
    overview,
    pain_trend: painTrend,
    trigger_distribution: triggerDist,
    patient_engagement: patientEngagement,
    pain_distribution: painDist,
    exercise_impact: exerciseImpact,
    day_of_week_pattern: dowPattern,
  };
}

async function getOverview(db: DbClient, providerId: string, days: number) {
  type Row = {
    total_patients: string;
    active_patients_7d: string;
    avg_pain_level: string;
    avg_pain_prev: string;
    total_logs_30d: string;
    exercise_compliance_pct: string;
  };

  const res = await db.execute<Row>(sql`
    WITH linked AS (
      SELECT patient_id FROM patient_provider_links
      WHERE provider_id = ${providerId} AND unlinked_at IS NULL
    ),
    current_pain AS (
      SELECT ROUND(AVG(pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days} || ' days')::interval
    ),
    prev_pain AS (
      SELECT ROUND(AVG(pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days * 2} || ' days')::interval
        AND sl.logged_at < NOW() - (${days} || ' days')::interval
    ),
    active AS (
      SELECT COUNT(DISTINCT sl.patient_id) AS cnt
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - INTERVAL '7 days'
    ),
    logs AS (
      SELECT COUNT(*) AS cnt
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days} || ' days')::interval
    ),
    compliance AS (
      SELECT
        CASE WHEN COUNT(ea.id) = 0 THEN 0
        ELSE ROUND(COUNT(DISTINCT ec.id)::numeric / GREATEST(COUNT(DISTINCT ea.id), 1) * 100, 0)
        END AS pct
      FROM exercise_assignments ea
      JOIN linked l ON ea.patient_id = l.patient_id
      LEFT JOIN exercise_completions ec ON ec.assignment_id = ea.id
        AND ec.completed_at >= NOW() - (${days} || ' days')::interval
      WHERE ea.status = 'active'
    )
    SELECT
      (SELECT COUNT(*) FROM linked)::text AS total_patients,
      (SELECT cnt FROM active)::text AS active_patients_7d,
      COALESCE((SELECT avg_pain FROM current_pain), 0)::text AS avg_pain_level,
      COALESCE((SELECT avg_pain FROM prev_pain), 0)::text AS avg_pain_prev,
      (SELECT cnt FROM logs)::text AS total_logs_30d,
      (SELECT pct FROM compliance)::text AS exercise_compliance_pct
  `);

  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  const avgPain = parseFloat(r?.avg_pain_level ?? '0');
  const avgPainPrev = parseFloat(r?.avg_pain_prev ?? '0');

  return {
    total_patients: parseInt(r?.total_patients ?? '0', 10),
    active_patients_7d: parseInt(r?.active_patients_7d ?? '0', 10),
    avg_pain_level: avgPain,
    avg_pain_trend: avgPainPrev > 0 ? Math.round((avgPain - avgPainPrev) * 10) / 10 : 0,
    total_logs_30d: parseInt(r?.total_logs_30d ?? '0', 10),
    exercise_compliance_pct: parseInt(r?.exercise_compliance_pct ?? '0', 10),
  };
}

async function getPainTrend(db: DbClient, providerId: string, days: number) {
  type Row = { date: string; avg_pain: string; log_count: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(sl.logged_at)::text AS date,
           ROUND(AVG(sl.pain_level)::numeric, 1)::text AS avg_pain,
           COUNT(*)::text AS log_count
    FROM symptom_logs sl
    JOIN patient_provider_links ppl ON ppl.patient_id = sl.patient_id
    WHERE ppl.provider_id = ${providerId} AND ppl.unlinked_at IS NULL
      AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(sl.logged_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    date: r.date,
    avg_pain: parseFloat(r.avg_pain),
    log_count: parseInt(r.log_count, 10),
  }));
}

async function getTriggerDistribution(db: DbClient, providerId: string, days: number) {
  type Row = { trigger: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT t.trigger, COUNT(*)::text AS count
    FROM symptom_logs sl
    JOIN patient_provider_links ppl ON ppl.patient_id = sl.patient_id,
    LATERAL unnest(sl.triggers) AS t(trigger)
    WHERE ppl.provider_id = ${providerId} AND ppl.unlinked_at IS NULL
      AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY t.trigger ORDER BY count DESC LIMIT 10
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const total = rows.reduce((s, r) => s + parseInt(r.count, 10), 0);
  return rows.map((r) => ({
    trigger: r.trigger,
    count: parseInt(r.count, 10),
    pct: total > 0 ? Math.round((parseInt(r.count, 10) / total) * 100) : 0,
  }));
}

async function getPatientEngagement(db: DbClient, providerId: string, days: number) {
  type Row = {
    patient_id: string;
    first_name: string;
    last_name: string;
    logs_30d: string;
    avg_pain: string;
    prev_avg_pain: string;
    last_log_at: string | null;
    exercises_completed_30d: string;
  };
  const res = await db.execute<Row>(sql`
    WITH linked AS (
      SELECT patient_id FROM patient_provider_links
      WHERE provider_id = ${providerId} AND unlinked_at IS NULL
    ),
    current_stats AS (
      SELECT sl.patient_id,
             COUNT(*)::text AS logs_30d,
             ROUND(AVG(sl.pain_level)::numeric, 1)::text AS avg_pain,
             MAX(sl.logged_at)::text AS last_log_at
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY sl.patient_id
    ),
    prev_stats AS (
      SELECT sl.patient_id,
             ROUND(AVG(sl.pain_level)::numeric, 1)::text AS prev_avg_pain
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days * 2} || ' days')::interval
        AND sl.logged_at < NOW() - (${days} || ' days')::interval
      GROUP BY sl.patient_id
    ),
    completions AS (
      SELECT ea.patient_id, COUNT(ec.id)::text AS exercises_completed_30d
      FROM exercise_assignments ea
      JOIN linked l ON ea.patient_id = l.patient_id
      LEFT JOIN exercise_completions ec ON ec.assignment_id = ea.id
        AND ec.completed_at >= NOW() - (${days} || ' days')::interval
      GROUP BY ea.patient_id
    )
    SELECT l.patient_id, p.first_name, p.last_name,
           COALESCE(cs.logs_30d, '0') AS logs_30d,
           COALESCE(cs.avg_pain, '0') AS avg_pain,
           COALESCE(ps.prev_avg_pain, '0') AS prev_avg_pain,
           cs.last_log_at,
           COALESCE(c.exercises_completed_30d, '0') AS exercises_completed_30d
    FROM linked l
    JOIN profiles p ON p.user_id = l.patient_id
    LEFT JOIN current_stats cs ON cs.patient_id = l.patient_id
    LEFT JOIN prev_stats ps ON ps.patient_id = l.patient_id
    LEFT JOIN completions c ON c.patient_id = l.patient_id
    ORDER BY cs.last_log_at DESC NULLS LAST
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    patient_id: r.patient_id,
    first_name: r.first_name,
    last_name: r.last_name,
    logs_30d: parseInt(r.logs_30d, 10),
    avg_pain: parseFloat(r.avg_pain),
    pain_delta: Math.round((parseFloat(r.avg_pain) - parseFloat(r.prev_avg_pain)) * 10) / 10,
    last_log_at: r.last_log_at,
    exercises_completed_30d: parseInt(r.exercises_completed_30d, 10),
  }));
}

async function getPainDistribution(db: DbClient, providerId: string, days: number) {
  type Row = { level: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT sl.pain_level::text AS level, COUNT(*)::text AS count
    FROM symptom_logs sl
    JOIN patient_provider_links ppl ON ppl.patient_id = sl.patient_id
    WHERE ppl.provider_id = ${providerId} AND ppl.unlinked_at IS NULL
      AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY sl.pain_level ORDER BY sl.pain_level
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    level: parseInt(r.level, 10),
    count: parseInt(r.count, 10),
  }));
}

async function getExerciseImpact(db: DbClient, providerId: string, days: number) {
  type Row = { exercised: string; avg_pain: string; day_count: string };
  const res = await db.execute<Row>(sql`
    WITH linked AS (
      SELECT patient_id FROM patient_provider_links
      WHERE provider_id = ${providerId} AND unlinked_at IS NULL
    ),
    daily_pain AS (
      SELECT sl.patient_id, DATE(sl.logged_at) AS d, ROUND(AVG(sl.pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs sl JOIN linked l ON sl.patient_id = l.patient_id
      WHERE sl.logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY sl.patient_id, DATE(sl.logged_at)
    ),
    exercise_days AS (
      SELECT DISTINCT ec.patient_id, DATE(ec.completed_at) AS d
      FROM exercise_completions ec JOIN linked l ON ec.patient_id = l.patient_id
      WHERE ec.completed_at >= NOW() - (${days} || ' days')::interval
    )
    SELECT
      CASE WHEN ed.d IS NOT NULL THEN 'yes' ELSE 'no' END AS exercised,
      ROUND(AVG(dp.avg_pain)::numeric, 1)::text AS avg_pain,
      COUNT(*)::text AS day_count
    FROM daily_pain dp
    LEFT JOIN exercise_days ed ON ed.patient_id = dp.patient_id AND ed.d = dp.d
    GROUP BY CASE WHEN ed.d IS NOT NULL THEN 'yes' ELSE 'no' END
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const yes = rows.find((r) => r.exercised === 'yes');
  const no = rows.find((r) => r.exercised === 'no');
  return {
    with_exercise_avg_pain: parseFloat(yes?.avg_pain ?? '0'),
    without_exercise_avg_pain: parseFloat(no?.avg_pain ?? '0'),
    with_exercise_days: parseInt(yes?.day_count ?? '0', 10),
    without_exercise_days: parseInt(no?.day_count ?? '0', 10),
  };
}

async function getDayOfWeekPattern(db: DbClient, providerId: string, days: number) {
  type Row = { day_name: string; avg_pain: string; log_count: string; dow: string };
  const res = await db.execute<Row>(sql`
    SELECT TO_CHAR(sl.logged_at, 'Dy') AS day_name,
           EXTRACT(DOW FROM sl.logged_at)::text AS dow,
           ROUND(AVG(sl.pain_level)::numeric, 1)::text AS avg_pain,
           COUNT(*)::text AS log_count
    FROM symptom_logs sl
    JOIN patient_provider_links ppl ON ppl.patient_id = sl.patient_id
    WHERE ppl.provider_id = ${providerId} AND ppl.unlinked_at IS NULL
      AND sl.logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY TO_CHAR(sl.logged_at, 'Dy'), EXTRACT(DOW FROM sl.logged_at)
    ORDER BY dow
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    day: r.day_name,
    avg_pain: parseFloat(r.avg_pain),
    log_count: parseInt(r.log_count, 10),
  }));
}
