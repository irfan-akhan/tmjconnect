import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';

export async function getPainInsights(db: Db['db'], patientId: string, days: number) {
  type DailyRow = { date: string; avg_pain: string; count: string };
  type DowRow = { dow: string; avg_pain: string; count: string };
  type FreqRow = { value: string; count: string };
  type OverallRow = { avg_pain: string; total: string; recent_avg: string; prior_avg: string };

  const [dailyRes, dowRes, triggerRes, typeRes, overallRes] = await Promise.all([
    db.execute<DailyRow>(sql`
      SELECT DATE(logged_at)::text AS date,
             ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
             COUNT(*)::text AS count
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(logged_at) ORDER BY date
    `),
    db.execute<DowRow>(sql`
      SELECT EXTRACT(DOW FROM logged_at)::text AS dow,
             ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
             COUNT(*)::text AS count
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY EXTRACT(DOW FROM logged_at) ORDER BY dow
    `),
    db.execute<FreqRow>(sql`
      SELECT t AS value, COUNT(*)::text AS count
      FROM symptom_logs, UNNEST(triggers) AS t
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY t ORDER BY count DESC LIMIT 10
    `),
    db.execute<FreqRow>(sql`
      SELECT t AS value, COUNT(*)::text AS count
      FROM symptom_logs, UNNEST(pain_types) AS t
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY t ORDER BY count DESC LIMIT 10
    `),
    db.execute<OverallRow>(sql`
      SELECT
        ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
        COUNT(*)::text AS total,
        ROUND((SELECT AVG(pain_level) FROM symptom_logs
               WHERE patient_id = ${patientId}
                 AND logged_at >= NOW() - (${Math.ceil(days / 2)} || ' days')::interval
              )::numeric, 1)::text AS recent_avg,
        ROUND((SELECT AVG(pain_level) FROM symptom_logs
               WHERE patient_id = ${patientId}
                 AND logged_at >= NOW() - (${days} || ' days')::interval
                 AND logged_at < NOW() - (${Math.ceil(days / 2)} || ' days')::interval
              )::numeric, 1)::text AS prior_avg
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
    `),
  ]);

  const toArr = <T>(r: unknown): T[] => (Array.isArray(r) ? r : (r as { rows?: T[] }).rows ?? []);
  const overall = toArr<OverallRow>(overallRes)[0];
  const recentAvg = parseFloat(overall?.recent_avg ?? '0');
  const priorAvg = parseFloat(overall?.prior_avg ?? '0');

  return {
    daily_averages: toArr<DailyRow>(dailyRes).map((r) => ({
      date: r.date,
      avg_pain: parseFloat(r.avg_pain),
      count: parseInt(r.count, 10),
    })),
    day_of_week: toArr<DowRow>(dowRes).map((r) => ({
      day: parseInt(r.dow, 10),
      avg_pain: parseFloat(r.avg_pain),
      count: parseInt(r.count, 10),
    })),
    trigger_frequency: toArr<FreqRow>(triggerRes).map((r) => ({
      trigger: r.value,
      count: parseInt(r.count, 10),
    })),
    pain_type_frequency: toArr<FreqRow>(typeRes).map((r) => ({
      type: r.value,
      count: parseInt(r.count, 10),
    })),
    overall: {
      avg_pain: parseFloat(overall?.avg_pain ?? '0'),
      total_logs: parseInt(overall?.total ?? '0', 10),
      trend: priorAvg > 0 ? +(recentAvg - priorAvg).toFixed(1) : 0,
    },
  };
}

export async function getSymptomExerciseCorrelation(db: Db['db'], patientId: string, days: number) {
  type Row = { exercised: string; avg_pain: string; day_count: string };

  const res = await db.execute<Row>(sql`
    WITH daily AS (
      SELECT DATE(logged_at) AS d, ROUND(AVG(pain_level)::numeric, 1) AS avg_pain
      FROM symptom_logs
      WHERE patient_id = ${patientId}
        AND logged_at >= NOW() - (${days} || ' days')::interval
      GROUP BY DATE(logged_at)
    ),
    exercise_days AS (
      SELECT DISTINCT DATE(completed_at) AS d
      FROM exercise_completions
      WHERE patient_id = ${patientId}
        AND completed_at >= NOW() - (${days} || ' days')::interval
    )
    SELECT
      CASE WHEN ed.d IS NOT NULL THEN 'yes' ELSE 'no' END AS exercised,
      ROUND(AVG(daily.avg_pain)::numeric, 1)::text AS avg_pain,
      COUNT(*)::text AS day_count
    FROM daily
    LEFT JOIN exercise_days ed ON ed.d = daily.d
    GROUP BY CASE WHEN ed.d IS NOT NULL THEN 'yes' ELSE 'no' END
  `);

  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const yes = rows.find((r) => r.exercised === 'yes');
  const no = rows.find((r) => r.exercised === 'no');

  return {
    exercise_days_avg_pain: parseFloat(yes?.avg_pain ?? '0'),
    exercise_days_count: parseInt(yes?.day_count ?? '0', 10),
    no_exercise_days_avg_pain: parseFloat(no?.avg_pain ?? '0'),
    no_exercise_days_count: parseInt(no?.day_count ?? '0', 10),
  };
}
