import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';

type DbClient = Db['db'];

export type PlatformAnalytics = {
  user_growth: Array<{ date: string; patients: number; providers: number }>;
  pain_overview: { avg_pain: number; total_logs: number; active_loggers: number };
  pain_trend: Array<{ date: string; avg_pain: number; log_count: number }>;
  pain_distribution: Array<{ level: number; count: number }>;
  top_triggers: Array<{ trigger: string; count: number; pct: number }>;
  report_volume: Array<{ date: string; total: number; urgent: number; concerning: number; routine: number }>;
  response_times: Array<{ date: string; avg_hours: number }>;
  exercise_stats: { total_exercises: number; total_assignments: number; completion_rate: number };
  engagement_funnel: { total_users: number; verified: number; with_profile: number; active_7d: number; active_30d: number };
  provider_workload: Array<{ provider_id: string; name: string; patient_count: number; reports_30d: number; avg_response_hours: number | null }>;
};

export async function getPlatformAnalytics(db: DbClient, days: number): Promise<PlatformAnalytics> {
  const [
    userGrowth, painOverview, painTrend, painDist,
    topTriggers, reportVolume, responseTimes,
    exerciseStats, engagementFunnel, providerWorkload,
  ] = await Promise.all([
    getUserGrowth(db, days),
    getPainOverview(db, days),
    getPainTrend(db, days),
    getPainDistribution(db, days),
    getTopTriggers(db, days),
    getReportVolume(db, days),
    getResponseTimes(db, days),
    getExerciseStats(db, days),
    getEngagementFunnel(db),
    getProviderWorkload(db, days),
  ]);

  return {
    user_growth: userGrowth,
    pain_overview: painOverview,
    pain_trend: painTrend,
    pain_distribution: painDist,
    top_triggers: topTriggers,
    report_volume: reportVolume,
    response_times: responseTimes,
    exercise_stats: exerciseStats,
    engagement_funnel: engagementFunnel,
    provider_workload: providerWorkload,
  };
}

async function getUserGrowth(db: DbClient, days: number) {
  type Row = { date: string; patients: string; providers: string };
  const res = await db.execute<Row>(sql`
    SELECT d::date::text AS date,
           COALESCE(SUM(CASE WHEN u.role = 'patient' THEN 1 ELSE 0 END), 0)::text AS patients,
           COALESCE(SUM(CASE WHEN u.role = 'provider' THEN 1 ELSE 0 END), 0)::text AS providers
    FROM generate_series(NOW() - (${days} || ' days')::interval, NOW(), '1 day') AS d
    LEFT JOIN users u ON DATE(u.created_at) = d::date
    GROUP BY d::date ORDER BY d::date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ date: r.date, patients: parseInt(r.patients, 10), providers: parseInt(r.providers, 10) }));
}

async function getPainOverview(db: DbClient, days: number) {
  type Row = { avg_pain: string; total_logs: string; active_loggers: string };
  const res = await db.execute<Row>(sql`
    SELECT ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
           COUNT(*)::text AS total_logs,
           COUNT(DISTINCT patient_id)::text AS active_loggers
    FROM symptom_logs WHERE logged_at >= NOW() - (${days} || ' days')::interval
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  return {
    avg_pain: parseFloat(r?.avg_pain ?? '0'),
    total_logs: parseInt(r?.total_logs ?? '0', 10),
    active_loggers: parseInt(r?.active_loggers ?? '0', 10),
  };
}

async function getPainTrend(db: DbClient, days: number) {
  type Row = { date: string; avg_pain: string; log_count: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(logged_at)::text AS date,
           ROUND(AVG(pain_level)::numeric, 1)::text AS avg_pain,
           COUNT(*)::text AS log_count
    FROM symptom_logs WHERE logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(logged_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ date: r.date, avg_pain: parseFloat(r.avg_pain), log_count: parseInt(r.log_count, 10) }));
}

async function getPainDistribution(db: DbClient, days: number) {
  type Row = { level: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT pain_level::text AS level, COUNT(*)::text AS count
    FROM symptom_logs WHERE logged_at >= NOW() - (${days} || ' days')::interval
    GROUP BY pain_level ORDER BY pain_level
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ level: parseInt(r.level, 10), count: parseInt(r.count, 10) }));
}

async function getTopTriggers(db: DbClient, days: number) {
  type Row = { trigger: string; count: string };
  const res = await db.execute<Row>(sql`
    SELECT t.trigger, COUNT(*)::text AS count
    FROM symptom_logs sl, LATERAL unnest(sl.triggers) AS t(trigger)
    WHERE sl.logged_at >= NOW() - (${days} || ' days')::interval
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

async function getReportVolume(db: DbClient, days: number) {
  type Row = { date: string; total: string; urgent: string; concerning: string; routine: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(submitted_at)::text AS date,
           COUNT(*)::text AS total,
           COUNT(*) FILTER (WHERE urgency = 'urgent')::text AS urgent,
           COUNT(*) FILTER (WHERE urgency = 'concerning')::text AS concerning,
           COUNT(*) FILTER (WHERE urgency = 'routine')::text AS routine
    FROM reports WHERE submitted_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(submitted_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    date: r.date,
    total: parseInt(r.total, 10),
    urgent: parseInt(r.urgent, 10),
    concerning: parseInt(r.concerning, 10),
    routine: parseInt(r.routine, 10),
  }));
}

async function getResponseTimes(db: DbClient, days: number) {
  type Row = { date: string; avg_hours: string };
  const res = await db.execute<Row>(sql`
    SELECT DATE(rr.responded_at)::text AS date,
           ROUND(AVG(EXTRACT(EPOCH FROM (rr.responded_at - r.submitted_at)) / 3600)::numeric, 1)::text AS avg_hours
    FROM report_responses rr
    JOIN reports r ON r.id = rr.report_id
    WHERE rr.responded_at >= NOW() - (${days} || ' days')::interval
    GROUP BY DATE(rr.responded_at) ORDER BY date
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({ date: r.date, avg_hours: parseFloat(r.avg_hours) }));
}

async function getExerciseStats(db: DbClient, days: number) {
  type Row = { total_exercises: string; total_assignments: string; completions: string; active_assignments: string };
  const res = await db.execute<Row>(sql`
    SELECT
      (SELECT COUNT(*) FROM exercises)::text AS total_exercises,
      (SELECT COUNT(*) FROM exercise_assignments WHERE status = 'active')::text AS total_assignments,
      (SELECT COUNT(*) FROM exercise_completions WHERE completed_at >= NOW() - (${days} || ' days')::interval)::text AS completions,
      (SELECT COUNT(DISTINCT id) FROM exercise_assignments WHERE status = 'active')::text AS active_assignments
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  const completions = parseInt(r?.completions ?? '0', 10);
  const active = parseInt(r?.active_assignments ?? '1', 10);
  return {
    total_exercises: parseInt(r?.total_exercises ?? '0', 10),
    total_assignments: parseInt(r?.total_assignments ?? '0', 10),
    completion_rate: active > 0 ? Math.round((completions / active) * 100) : 0,
  };
}

async function getEngagementFunnel(db: DbClient) {
  type Row = { total_users: string; verified: string; with_profile: string; active_7d: string; active_30d: string };
  const res = await db.execute<Row>(sql`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'patient')::text AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'patient' AND email_verified = true)::text AS verified,
      (SELECT COUNT(*) FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.role = 'patient' AND p.first_name IS NOT NULL)::text AS with_profile,
      (SELECT COUNT(DISTINCT patient_id) FROM symptom_logs WHERE logged_at >= NOW() - INTERVAL '7 days')::text AS active_7d,
      (SELECT COUNT(DISTINCT patient_id) FROM symptom_logs WHERE logged_at >= NOW() - INTERVAL '30 days')::text AS active_30d
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  const r = rows[0];
  return {
    total_users: parseInt(r?.total_users ?? '0', 10),
    verified: parseInt(r?.verified ?? '0', 10),
    with_profile: parseInt(r?.with_profile ?? '0', 10),
    active_7d: parseInt(r?.active_7d ?? '0', 10),
    active_30d: parseInt(r?.active_30d ?? '0', 10),
  };
}

async function getProviderWorkload(db: DbClient, days: number) {
  type Row = { provider_id: string; name: string; patient_count: string; reports_30d: string; avg_response_hours: string | null };
  const res = await db.execute<Row>(sql`
    SELECT
      u.id AS provider_id,
      COALESCE(p.first_name || ' ' || p.last_name, u.email) AS name,
      (SELECT COUNT(*) FROM patient_provider_links WHERE provider_id = u.id AND unlinked_at IS NULL)::text AS patient_count,
      (SELECT COUNT(*) FROM reports WHERE provider_id = u.id AND submitted_at >= NOW() - (${days} || ' days')::interval)::text AS reports_30d,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (rr.responded_at - r.submitted_at)) / 3600)::numeric, 1)::text
       FROM report_responses rr JOIN reports r ON r.id = rr.report_id
       WHERE r.provider_id = u.id AND rr.responded_at >= NOW() - (${days} || ' days')::interval) AS avg_response_hours
    FROM users u LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.role = 'provider' AND u.is_active = true
    ORDER BY patient_count DESC LIMIT 20
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows.map((r) => ({
    provider_id: r.provider_id,
    name: r.name,
    patient_count: parseInt(r.patient_count, 10),
    reports_30d: parseInt(r.reports_30d, 10),
    avg_response_hours: r.avg_response_hours ? parseFloat(r.avg_response_hours) : null,
  }));
}
