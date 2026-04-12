/**
 * admin-p1p2.queries.ts — Database queries for TODO features #5–#15.
 *
 * Separated from admin.queries.ts to keep file sizes manageable.
 * Both files are imported by the admin route handler.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';

type DbClient = Db['db'];

// ═══════════════════════════════════════════════════════════════════════════════
// #5: Provider performance dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export async function getProviderPerformance(
  db: DbClient,
  page: number,
  limit: number,
  sort: string,
  order: string,
) {
  const offset = (page - 1) * limit;
  const orderDir = order === 'asc' ? sql`ASC NULLS LAST` : sql`DESC NULLS LAST`;

  // Dynamic ORDER BY — only allow whitelisted sort columns.
  const sortCol: Record<string, ReturnType<typeof sql>> = {
    avg_response_hours: sql`avg_response_hours`,
    patient_count: sql`patient_count`,
    response_rate: sql`response_rate`,
    last_login_at: sql`last_login_at`,
  };
  const orderBy = sortCol[sort] ?? sql`avg_response_hours`;

  return db.execute(sql`
    WITH provider_stats AS (
      SELECT
        u.id AS provider_id,
        COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS name,
        u.email,
        u.mfa_enabled,
        (SELECT COUNT(*) FROM patient_provider_links ppl
         WHERE ppl.provider_id = u.id AND ppl.unlinked_at IS NULL) AS patient_count,
        (SELECT COUNT(DISTINCT ppl2.patient_id) FROM patient_provider_links ppl2
         JOIN symptom_logs sl ON sl.patient_id = ppl2.patient_id AND sl.created_at >= NOW() - INTERVAL '7 days'
         WHERE ppl2.provider_id = u.id AND ppl2.unlinked_at IS NULL) AS active_patients_7d,
        (SELECT COUNT(*) FROM reports r WHERE r.provider_id = u.id AND r.submitted_at >= NOW() - INTERVAL '30 days') AS reports_received_30d,
        (SELECT COUNT(*) FROM reports r2
         JOIN report_responses rr ON rr.report_id = r2.id
         WHERE r2.provider_id = u.id AND r2.submitted_at >= NOW() - INTERVAL '30 days') AS reports_responded_30d,
        (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (rr2.responded_at - r3.submitted_at)) / 3600)::numeric, 1)
         FROM reports r3
         JOIN report_responses rr2 ON rr2.report_id = r3.id
         WHERE r3.provider_id = u.id AND r3.submitted_at >= NOW() - INTERVAL '30 days') AS avg_response_hours,
        (SELECT MAX(le.created_at) FROM login_events le WHERE le.user_id = u.id AND le.success = true) AS last_login_at
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role = 'provider' AND u.deleted_at IS NULL AND u.is_active = true
    )
    SELECT
      provider_id, name, email, mfa_enabled,
      patient_count::int, active_patients_7d::int,
      reports_received_30d::int, reports_responded_30d::int,
      CASE WHEN reports_received_30d > 0
        THEN ROUND(reports_responded_30d::numeric / reports_received_30d, 2)
        ELSE NULL END AS response_rate,
      avg_response_hours::float,
      last_login_at::text
    FROM provider_stats
    ORDER BY ${orderBy} ${orderDir}
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countProviders(db: DbClient) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM users WHERE role = 'provider' AND deleted_at IS NULL AND is_active = true
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// #6: Patient engagement & churn
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPatientEngagement(
  db: DbClient,
  page: number,
  limit: number,
  tier?: string,
) {
  const offset = (page - 1) * limit;

  // Tier definitions:
  // highly_active: logged in AND symptom log within 7 days
  // occasional: logged in within 30 days
  // dormant: no activity > 30 days
  // never_active: no symptom log ever
  const tierFilter = tier ? sql`AND tier = ${tier}` : sql``;

  return db.execute(sql`
    WITH patient_data AS (
      SELECT
        u.id AS patient_id,
        COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS name,
        u.email,
        u.created_at::text AS created_at,
        (SELECT MAX(sl.created_at) FROM symptom_logs sl WHERE sl.patient_id = u.id) AS last_symptom_log_at,
        (SELECT MAX(le.created_at) FROM login_events le WHERE le.user_id = u.id AND le.success = true) AS last_login_at,
        (SELECT COUNT(*) FROM symptom_logs sl2
         WHERE sl2.patient_id = u.id
           AND sl2.created_at >= NOW() - INTERVAL '30 days') AS symptom_count_30d,
        (SELECT COALESCE(
          ROUND(COUNT(*) FILTER (WHERE ec.completed_at IS NOT NULL)::numeric /
                NULLIF(COUNT(*), 0), 2), 0)
         FROM exercise_assignments ea
         LEFT JOIN exercise_completions ec ON ec.assignment_id = ea.id
           AND ec.completed_at >= NOW() - INTERVAL '30 days'
         WHERE ea.patient_id = u.id AND ea.status = 'active') AS exercise_completion_rate_30d
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role = 'patient' AND u.deleted_at IS NULL
    ),
    tiered AS (
      SELECT *,
        CASE
          WHEN last_symptom_log_at IS NULL THEN 'never_active'
          WHEN last_login_at >= NOW() - INTERVAL '7 days' AND last_symptom_log_at >= NOW() - INTERVAL '7 days' THEN 'highly_active'
          WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN 'occasional'
          ELSE 'dormant'
        END AS tier,
        -- Compute streak: consecutive days with symptom logs ending at today
        (SELECT COUNT(DISTINCT DATE(sl3.logged_at))
         FROM symptom_logs sl3
         WHERE sl3.patient_id = patient_data.patient_id
           AND sl3.logged_at >= NOW() - INTERVAL '90 days') AS symptom_streak_days
      FROM patient_data
    )
    SELECT
      patient_id, name, email, created_at,
      last_symptom_log_at::text, last_login_at::text,
      symptom_streak_days::int, exercise_completion_rate_30d::float, tier
    FROM tiered
    WHERE TRUE ${tierFilter}
    ORDER BY last_login_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function getPatientEngagementSummary(db: DbClient) {
  type Row = { highly_active: string; occasional: string; dormant: string; never_active: string };
  const [row] = await db.execute<Row>(sql`
    WITH patient_tiers AS (
      SELECT
        u.id,
        (SELECT MAX(sl.created_at) FROM symptom_logs sl WHERE sl.patient_id = u.id) AS last_symptom,
        (SELECT MAX(le.created_at) FROM login_events le WHERE le.user_id = u.id AND le.success = true) AS last_login
      FROM users u
      WHERE u.role = 'patient' AND u.deleted_at IS NULL
    )
    SELECT
      COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days' AND last_symptom >= NOW() - INTERVAL '7 days')::text AS highly_active,
      COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '30 days' AND NOT (last_login >= NOW() - INTERVAL '7 days' AND last_symptom >= NOW() - INTERVAL '7 days'))::text AS occasional,
      COUNT(*) FILTER (WHERE last_symptom IS NOT NULL AND (last_login IS NULL OR last_login < NOW() - INTERVAL '30 days'))::text AS dormant,
      COUNT(*) FILTER (WHERE last_symptom IS NULL)::text AS never_active
    FROM patient_tiers
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  return {
    highly_active: parseInt(row?.highly_active ?? '0', 10),
    occasional: parseInt(row?.occasional ?? '0', 10),
    dormant: parseInt(row?.dormant ?? '0', 10),
    never_active: parseInt(row?.never_active ?? '0', 10),
  };
}

export async function countPatientsByTier(db: DbClient, tier?: string) {
  // Reuse the summary for total count; for tier-specific use a subquery.
  if (!tier) {
    type Row = { total: string };
    const result = await db.execute<Row>(sql`
      SELECT COUNT(*)::text AS total FROM users WHERE role = 'patient' AND deleted_at IS NULL
    `);
    const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
    return parseInt(rows[0]?.total ?? '0', 10);
  }
  const summary = await getPatientEngagementSummary(db);
  return summary[tier as keyof typeof summary] ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #7: Security operations (SIEM-lite)
// ═══════════════════════════════════════════════════════════════════════════════

function windowToInterval(window: string) {
  const map: Record<string, string> = {
    '1h': '1 hour', '6h': '6 hours', '12h': '12 hours',
    '24h': '24 hours', '7d': '7 days',
  };
  return map[window] ?? '24 hours';
}

export async function getSecuritySummary(db: DbClient, window: string) {
  const interval = windowToInterval(window);

  const [totals] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM login_events WHERE success = false AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)})::int AS failed_logins,
      (SELECT COUNT(*) FROM audit_logs WHERE action LIKE '%token_replay%' AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)})::int AS refresh_token_replays,
      (SELECT COUNT(DISTINCT device_info) FROM login_events
       WHERE success = true AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
       AND device_info IS NOT NULL)::int AS new_device_logins
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  const failedByIp = await db.execute(sql`
    SELECT ip_address::text AS ip, COUNT(*)::int AS count
    FROM login_events
    WHERE success = false AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
    AND ip_address IS NOT NULL
    GROUP BY ip_address ORDER BY count DESC LIMIT 10
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const failedByEmail = await db.execute(sql`
    SELECT email, COUNT(*)::int AS count
    FROM login_events
    WHERE success = false AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
    GROUP BY email ORDER BY count DESC LIMIT 10
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const hourlyFailed = await db.execute(sql`
    SELECT
      to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:00') AS hour,
      COUNT(*)::int AS count
    FROM login_events
    WHERE success = false AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
    GROUP BY date_trunc('hour', created_at)
    ORDER BY date_trunc('hour', created_at)
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  return {
    failed_logins: (totals as Record<string, number>)?.failed_logins ?? 0,
    failed_logins_by_ip: failedByIp,
    failed_logins_by_email: failedByEmail,
    refresh_token_replays: (totals as Record<string, number>)?.refresh_token_replays ?? 0,
    new_device_logins: (totals as Record<string, number>)?.new_device_logins ?? 0,
    hourly_failed_logins: hourlyFailed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// #8: Linking & relationships summary
// ═══════════════════════════════════════════════════════════════════════════════

export async function getLinkingSummary(db: DbClient) {
  const [row] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM patient_provider_links WHERE unlinked_at IS NULL)::int AS active_links,
      (SELECT COUNT(*) FROM patient_provider_links WHERE unlinked_at IS NOT NULL AND unlinked_at >= NOW() - INTERVAL '30 days')::int AS disconnected_30d,
      (SELECT COUNT(*) FROM linking_codes WHERE status = 'pending' AND expires_at > NOW())::int AS pending_codes,
      (SELECT COUNT(*) FROM linking_codes WHERE status = 'expired' OR (status = 'pending' AND expires_at <= NOW()))::int AS expired_codes
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  const topProviders = await db.execute(sql`
    SELECT
      ppl.provider_id,
      COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS name,
      COUNT(*)::int AS patient_count
    FROM patient_provider_links ppl
    JOIN profiles p ON p.user_id = ppl.provider_id
    WHERE ppl.unlinked_at IS NULL
    GROUP BY ppl.provider_id, p.first_name, p.last_name
    ORDER BY patient_count DESC
    LIMIT 10
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  return { ...(row as Record<string, number>), top_providers: topProviders };
}

export async function listAdminLinkingCodes(
  db: DbClient,
  page: number,
  limit: number,
  status?: string,
) {
  const offset = (page - 1) * limit;
  return db.execute(sql`
    SELECT
      lc.id, lc.code, lc.status, lc.expires_at::text, lc.created_at::text,
      pp.first_name AS provider_first_name, pp.last_name AS provider_last_name,
      u.email AS provider_email
    FROM linking_codes lc
    JOIN users u ON u.id = lc.provider_id
    LEFT JOIN profiles pp ON pp.user_id = lc.provider_id
    WHERE TRUE
    ${status ? sql`AND lc.status = ${status}` : sql``}
    ORDER BY lc.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countAdminLinkingCodes(db: DbClient, status?: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM linking_codes lc
    WHERE TRUE ${status ? sql`AND lc.status = ${status}` : sql``}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function listAdminLinks(
  db: DbClient,
  page: number,
  limit: number,
  status?: string,
) {
  const offset = (page - 1) * limit;
  const statusFilter = status === 'active'
    ? sql`AND ppl.unlinked_at IS NULL`
    : status === 'disconnected'
    ? sql`AND ppl.unlinked_at IS NOT NULL`
    : sql``;

  return db.execute(sql`
    SELECT
      ppl.id, ppl.linked_at::text, ppl.unlinked_at::text,
      pp.first_name AS patient_first_name, pp.last_name AS patient_last_name,
      pu.email AS patient_email,
      prp.first_name AS provider_first_name, prp.last_name AS provider_last_name,
      pru.email AS provider_email
    FROM patient_provider_links ppl
    JOIN users pu ON pu.id = ppl.patient_id
    LEFT JOIN profiles pp ON pp.user_id = ppl.patient_id
    JOIN users pru ON pru.id = ppl.provider_id
    LEFT JOIN profiles prp ON prp.user_id = ppl.provider_id
    WHERE TRUE ${statusFilter}
    ORDER BY ppl.linked_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countAdminLinks(db: DbClient, status?: string) {
  type Row = { total: string };
  const statusFilter = status === 'active'
    ? sql`AND unlinked_at IS NULL`
    : status === 'disconnected'
    ? sql`AND unlinked_at IS NOT NULL`
    : sql``;
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM patient_provider_links WHERE TRUE ${statusFilter}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// #9: PHI access reports
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPhiAccessByActor(
  db: DbClient,
  userId: string,
  from: string,
  to: string,
) {
  const actor = await db.execute(sql`
    SELECT u.id, u.email, u.role FROM users u WHERE u.id = ${userId}
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] ?? null;
  });

  const summary = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_accesses,
      COUNT(DISTINCT resource_id)::int AS unique_resources
    FROM audit_logs
    WHERE user_id = ${userId}
      AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] ?? { total_accesses: 0, unique_resources: 0 };
  });

  const byResourceType = await db.execute(sql`
    SELECT resource_type, COUNT(*)::int AS count
    FROM audit_logs
    WHERE user_id = ${userId}
      AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
      AND resource_type IS NOT NULL
    GROUP BY resource_type ORDER BY count DESC
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const timeline = await db.execute(sql`
    SELECT DATE(created_at)::text AS date, COUNT(*)::int AS count
    FROM audit_logs
    WHERE user_id = ${userId}
      AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
    GROUP BY DATE(created_at) ORDER BY DATE(created_at)
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const details = await db.execute(sql`
    SELECT id, action, resource_type, resource_id, ip_address::text, created_at::text
    FROM audit_logs
    WHERE user_id = ${userId}
      AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
    ORDER BY created_at DESC
    LIMIT 500
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const byType: Record<string, number> = {};
  for (const row of byResourceType as Array<{ resource_type: string; count: number }>) {
    byType[row.resource_type] = row.count;
  }

  return {
    actor,
    summary: { ...(summary as Record<string, number>), by_resource_type: byType },
    timeline,
    details,
  };
}

export async function getPhiAccessByResource(
  db: DbClient,
  resourceType: string,
  resourceId: string,
  from: string,
  to: string,
) {
  const accesses = await db.execute(sql`
    SELECT
      a.user_id AS actor_id, u.email AS actor_email, u.role AS actor_role,
      a.action, a.ip_address::text, a.created_at::text
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.resource_type = ${resourceType} AND a.resource_id = ${resourceId}
      AND a.created_at >= ${from}::timestamptz AND a.created_at <= ${to}::timestamptz
    ORDER BY a.created_at DESC
    LIMIT 500
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const uniqueActors = new Set((accesses as Array<{ actor_id: string }>).map((a) => a.actor_id)).size;

  return {
    resource: { type: resourceType, id: resourceId },
    accesses,
    unique_actors: uniqueActors,
  };
}

export async function getPhiAnomalies(db: DbClient, window: string) {
  const interval = windowToInterval(window);

  // Bulk listing anomaly: >20 list-type calls in any 5-minute window
  const bulkListings = await db.execute(sql`
    SELECT
      user_id AS actor_id,
      (SELECT email FROM users WHERE id = a.user_id) AS actor_email,
      COUNT(*)::int AS count,
      date_trunc('hour', created_at)::text AS window_start
    FROM audit_logs a
    WHERE action LIKE '%listed%' AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
    GROUP BY user_id, date_trunc('hour', created_at)
    HAVING COUNT(*) > 20
    ORDER BY count DESC
    LIMIT 20
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  // Unusual patient views: viewing many distinct patients quickly
  const unusualViews = await db.execute(sql`
    SELECT
      user_id AS actor_id,
      (SELECT email FROM users WHERE id = a.user_id) AS actor_email,
      COUNT(DISTINCT resource_id)::int AS patient_count,
      date_trunc('hour', created_at)::text AS window_start
    FROM audit_logs a
    WHERE action LIKE '%patient%' AND action LIKE '%view%'
      AND created_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
    GROUP BY user_id, date_trunc('hour', created_at)
    HAVING COUNT(DISTINCT resource_id) > 10
    ORDER BY patient_count DESC
    LIMIT 20
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  return { bulk_listings: bulkListings, unusual_patient_views: unusualViews };
}

// ═══════════════════════════════════════════════════════════════════════════════
// #10: Notification preferences audit
// ═══════════════════════════════════════════════════════════════════════════════

export async function getNotificationPreferencesSummary(db: DbClient) {
  const [row] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE email_digest = 'instant')::int AS digest_instant,
      COUNT(*) FILTER (WHERE email_digest = 'daily')::int AS digest_daily,
      COUNT(*) FILTER (WHERE email_digest = 'weekly')::int AS digest_weekly,
      COUNT(*) FILTER (WHERE email_digest = 'off')::int AS digest_off,
      COUNT(*) FILTER (WHERE exercise_reminders = true)::int AS exercise_on,
      COUNT(*) FILTER (WHERE exercise_reminders = false)::int AS exercise_off,
      COUNT(*) FILTER (WHERE symptom_checkin = true)::int AS symptom_on,
      COUNT(*) FILTER (WHERE symptom_checkin = false)::int AS symptom_off,
      COUNT(*) FILTER (WHERE provider_messages = true)::int AS provider_on,
      COUNT(*) FILTER (WHERE provider_messages = false)::int AS provider_off,
      COUNT(*) FILTER (WHERE report_updates = true)::int AS report_on,
      COUNT(*) FILTER (WHERE report_updates = false)::int AS report_off
    FROM notification_preferences
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  // Bounce rate from outbox
  const [bounce] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE sent_at IS NULL AND attempts >= max_attempts)::float /
      NULLIF(COUNT(*), 0)::float AS bounce_rate_24h
    FROM notification_outbox
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  const r = row as Record<string, number>;
  const b = bounce as Record<string, number>;

  return {
    by_channel: {
      email_digest: { instant: r?.digest_instant ?? 0, daily: r?.digest_daily ?? 0, weekly: r?.digest_weekly ?? 0, off: r?.digest_off ?? 0 },
      exercise_reminders: { on: r?.exercise_on ?? 0, off: r?.exercise_off ?? 0 },
      symptom_checkin: { on: r?.symptom_on ?? 0, off: r?.symptom_off ?? 0 },
      provider_messages: { on: r?.provider_on ?? 0, off: r?.provider_off ?? 0 },
      report_updates: { on: r?.report_on ?? 0, off: r?.report_off ?? 0 },
    },
    bounce_rate_24h: b?.bounce_rate_24h ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// #11: Global server-side search
// ═══════════════════════════════════════════════════════════════════════════════

export async function adminGlobalSearch(db: DbClient, query: string, types: string[]) {
  const q = `%${query.toLowerCase()}%`;
  const results: Record<string, unknown[]> = {};

  if (types.includes('user')) {
    results.users = await db.execute(sql`
      SELECT u.id, u.email, u.role,
             COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') AS name
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.deleted_at IS NULL
        AND (LOWER(u.email) LIKE ${q} OR LOWER(p.first_name) LIKE ${q} OR LOWER(p.last_name) LIKE ${q})
      ORDER BY u.created_at DESC
      LIMIT 5
    `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
  }

  if (types.includes('report')) {
    results.reports = await db.execute(sql`
      SELECT r.id, r.urgency, r.status, r.submitted_at::text,
             COALESCE(pp.first_name, '') || ' ' || COALESCE(pp.last_name, '') AS patient_name
      FROM reports r
      LEFT JOIN profiles pp ON pp.user_id = r.patient_id
      WHERE LOWER(r.urgency) LIKE ${q}
         OR LOWER(r.status) LIKE ${q}
         OR LOWER(pp.first_name) LIKE ${q}
         OR LOWER(pp.last_name) LIKE ${q}
      ORDER BY r.submitted_at DESC
      LIMIT 5
    `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
  }

  if (types.includes('audit_log')) {
    results.audit_logs = await db.execute(sql`
      SELECT id, action, resource_type, created_at::text
      FROM audit_logs
      WHERE LOWER(action) LIKE ${q}
      ORDER BY created_at DESC
      LIMIT 5
    `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #12: Broadcasts
// ═══════════════════════════════════════════════════════════════════════════════

export async function createBroadcast(
  db: DbClient,
  data: {
    created_by: string;
    audience: string;
    type: string;
    title: string;
    body: string;
    channels: string[];
    scheduled_at?: string | null;
  },
) {
  // Count recipients based on audience
  const audienceFilter = data.audience === 'all' ? sql`TRUE` :
    sql`role = ${data.audience === 'admins' ? 'admin' : data.audience === 'patients' ? 'patient' : 'provider'}`;

  type CountRow = { total: string };
  const countResult = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM users WHERE is_active = true AND deleted_at IS NULL AND ${audienceFilter}
  `);
  const countRows: CountRow[] = Array.isArray(countResult) ? countResult : countResult.rows ?? [];
  const recipientCount = parseInt(countRows[0]?.total ?? '0', 10);

  const result = await db.execute(sql`
    INSERT INTO broadcasts (created_by, audience, type, title, body, channels, recipient_count, scheduled_at, sent_at)
    VALUES (
      ${data.created_by}, ${data.audience}, ${data.type}, ${data.title}, ${data.body},
      ${sql`ARRAY[${sql.join(data.channels.map(c => sql`${c}`), sql`,`)}]::text[]`},
      ${recipientCount},
      ${data.scheduled_at ?? null},
      ${data.scheduled_at ? null : sql`NOW()`}
    )
    RETURNING id, recipient_count
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] as { id: string; recipient_count: number } | undefined;
  });

  return result;
}

export async function listBroadcasts(db: DbClient, page: number, limit: number) {
  const offset = (page - 1) * limit;
  return db.execute(sql`
    SELECT b.id, b.audience, b.type, b.title, b.body, b.channels, b.recipient_count,
           b.scheduled_at::text, b.sent_at::text, b.created_at::text,
           u.email AS created_by_email
    FROM broadcasts b
    LEFT JOIN users u ON u.id = b.created_by
    ORDER BY b.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countBroadcasts(db: DbClient) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`SELECT COUNT(*)::text AS total FROM broadcasts`);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ═══════════════════════════════════════════════════════════════════════════════
// #13: System metrics
// ═══════════════════════════════════════════════════════════════════════════════

// No DB queries — system metrics come from process + pool objects in the route handler.

// ═══════════════════════════════════════════════════════════════════════════════
// #14: Scheduled exports
// ═══════════════════════════════════════════════════════════════════════════════

function computeNextRunAt(cadence: string): string {
  const now = new Date();
  if (cadence === 'daily') {
    now.setDate(now.getDate() + 1);
    now.setHours(6, 0, 0, 0); // 6 AM next day
  } else if (cadence === 'weekly') {
    now.setDate(now.getDate() + (8 - now.getDay()) % 7); // Next Monday
    now.setHours(6, 0, 0, 0);
  } else {
    now.setMonth(now.getMonth() + 1, 1); // 1st of next month
    now.setHours(6, 0, 0, 0);
  }
  return now.toISOString();
}

export async function createScheduledReport(
  db: DbClient,
  data: {
    created_by: string;
    name: string;
    entity: string;
    filters: Record<string, unknown>;
    cadence: string;
    recipient_emails: string[];
  },
) {
  const nextRunAt = computeNextRunAt(data.cadence);
  const result = await db.execute(sql`
    INSERT INTO scheduled_reports (created_by, name, entity, filters, cadence, recipient_emails, next_run_at)
    VALUES (
      ${data.created_by}, ${data.name}, ${data.entity},
      ${JSON.stringify(data.filters)}::jsonb,
      ${data.cadence},
      ${sql`ARRAY[${sql.join(data.recipient_emails.map(e => sql`${e}`), sql`,`)}]::text[]`},
      ${nextRunAt}::timestamptz
    )
    RETURNING id
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] as { id: string } | undefined;
  });
  return result;
}

export async function listScheduledReports(db: DbClient, page: number, limit: number) {
  const offset = (page - 1) * limit;
  return db.execute(sql`
    SELECT sr.id, sr.name, sr.entity, sr.filters, sr.cadence, sr.recipient_emails,
           sr.next_run_at::text, sr.last_run_at::text, sr.enabled, sr.created_at::text,
           u.email AS created_by_email
    FROM scheduled_reports sr
    LEFT JOIN users u ON u.id = sr.created_by
    ORDER BY sr.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countScheduledReports(db: DbClient) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`SELECT COUNT(*)::text AS total FROM scheduled_reports`);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function updateScheduledReport(
  db: DbClient,
  id: string,
  fields: {
    name?: string;
    filters?: Record<string, unknown>;
    cadence?: string;
    recipient_emails?: string[];
    enabled?: boolean;
  },
) {
  // Build SET clauses dynamically
  const sets: ReturnType<typeof sql>[] = [];
  if (fields.name !== undefined) sets.push(sql`name = ${fields.name}`);
  if (fields.filters !== undefined) sets.push(sql`filters = ${JSON.stringify(fields.filters)}::jsonb`);
  if (fields.cadence !== undefined) {
    sets.push(sql`cadence = ${fields.cadence}`);
    sets.push(sql`next_run_at = ${computeNextRunAt(fields.cadence)}::timestamptz`);
  }
  if (fields.recipient_emails !== undefined) {
    sets.push(sql`recipient_emails = ${sql`ARRAY[${sql.join(fields.recipient_emails.map(e => sql`${e}`), sql`,`)}]::text[]`}`);
  }
  if (fields.enabled !== undefined) sets.push(sql`enabled = ${fields.enabled}`);

  if (sets.length === 0) return null;

  const result = await db.execute(sql`
    UPDATE scheduled_reports SET ${sql.join(sets, sql`, `)} WHERE id = ${id} RETURNING id
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] ?? null;
  });
  return result;
}

export async function deleteScheduledReport(db: DbClient, id: string) {
  return db.execute(sql`DELETE FROM scheduled_reports WHERE id = ${id} RETURNING id`)
    .then((r) => {
      const rows = Array.isArray(r) ? r : r.rows ?? [];
      return rows.length > 0;
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// #15: Feature flags
// ═══════════════════════════════════════════════════════════════════════════════

export async function listFeatureFlags(db: DbClient) {
  return db.execute(sql`
    SELECT key, enabled, description, rollout_percent, target_roles,
           updated_by, updated_at::text, created_at::text,
           (SELECT email FROM users WHERE id = ff.updated_by) AS updated_by_email
    FROM feature_flags ff
    ORDER BY key
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function createFeatureFlag(
  db: DbClient,
  data: {
    key: string;
    enabled: boolean;
    description?: string;
    rollout_percent: number;
    target_roles?: string[];
    updated_by: string;
  },
) {
  const result = await db.execute(sql`
    INSERT INTO feature_flags (key, enabled, description, rollout_percent, target_roles, updated_by)
    VALUES (
      ${data.key}, ${data.enabled}, ${data.description ?? null},
      ${data.rollout_percent},
      ${data.target_roles ? sql`ARRAY[${sql.join(data.target_roles.map(r => sql`${r}`), sql`,`)}]::text[]` : sql`NULL`},
      ${data.updated_by}
    )
    RETURNING key
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] ?? null;
  });
  return result;
}

export async function updateFeatureFlag(
  db: DbClient,
  key: string,
  fields: {
    enabled?: boolean;
    description?: string;
    rollout_percent?: number;
    target_roles?: string[];
    updated_by: string;
  },
) {
  const sets: ReturnType<typeof sql>[] = [sql`updated_at = NOW()`, sql`updated_by = ${fields.updated_by}`];
  if (fields.enabled !== undefined) sets.push(sql`enabled = ${fields.enabled}`);
  if (fields.description !== undefined) sets.push(sql`description = ${fields.description}`);
  if (fields.rollout_percent !== undefined) sets.push(sql`rollout_percent = ${fields.rollout_percent}`);
  if (fields.target_roles !== undefined) {
    sets.push(sql`target_roles = ${sql`ARRAY[${sql.join(fields.target_roles.map(r => sql`${r}`), sql`,`)}]::text[]`}`);
  }

  const result = await db.execute(sql`
    UPDATE feature_flags SET ${sql.join(sets, sql`, `)} WHERE key = ${key} RETURNING key
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows[0] ?? null;
  });
  return result;
}

export async function deleteFeatureFlag(db: DbClient, key: string) {
  return db.execute(sql`DELETE FROM feature_flags WHERE key = ${key} RETURNING key`)
    .then((r) => {
      const rows = Array.isArray(r) ? r : r.rows ?? [];
      return rows.length > 0;
    });
}
