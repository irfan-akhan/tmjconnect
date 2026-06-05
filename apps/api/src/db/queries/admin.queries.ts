/**
 * admin.queries.ts — All database interactions for the admin module.
 */
import { eq, and, sql, desc, isNull, isNotNull } from 'drizzle-orm';
import type { Db } from '../../config/database';
import {
  users,
  profiles,
  providerDetails,
  auditLogs,
  loginEvents,
  reports,
  sessions,
  notificationOutbox,
  jobRuns,
} from '../schema';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

function sortDirection(sortOrder: SortOrder = 'desc') {
  return sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
}

// ─── Stats ───────────────────────────────────────────────────────────────────────

type StatsRow = {
  total_users: string;
  active_users: string;
  patients: string;
  providers: string;
  reports_today: string;
  avg_response_hours: string | null;
};

export async function getAdminStats(db: DbClient) {
  const [stats] = await db.execute<StatsRow>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM users WHERE deleted_at IS NULL) AS total_users,
      (SELECT COUNT(*)::text FROM users WHERE is_active = true AND deleted_at IS NULL) AS active_users,
      (SELECT COUNT(*)::text FROM users WHERE role = 'patient' AND deleted_at IS NULL) AS patients,
      (SELECT COUNT(*)::text FROM users WHERE role = 'provider' AND deleted_at IS NULL) AS providers,
      (SELECT COUNT(*)::text FROM reports WHERE DATE(submitted_at) = CURRENT_DATE) AS reports_today,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (r2.reviewed_at - r2.submitted_at)) / 3600)::numeric, 1)::text
       FROM reports r2
       WHERE r2.reviewed_at IS NOT NULL
         AND r2.submitted_at >= NOW() - INTERVAL '30 days') AS avg_response_hours
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  return {
    total_users: parseInt(stats?.total_users ?? '0', 10),
    active_users: parseInt(stats?.active_users ?? '0', 10),
    patients: parseInt(stats?.patients ?? '0', 10),
    providers: parseInt(stats?.providers ?? '0', 10),
    reports_today: parseInt(stats?.reports_today ?? '0', 10),
    avg_response_hours: stats?.avg_response_hours ? parseFloat(stats.avg_response_hours) : null,
  };
}

// ─── User management ─────────────────────────────────────────────────────────────

type UserFilters = {
  search?: string;
  role?: 'patient' | 'provider' | 'admin';
  is_active?: boolean;
  from?: string;
  to?: string;
};

function buildUserFilters(filters: UserFilters) {
  return sql`
    u.deleted_at IS NULL
    ${filters.search ? sql`AND (LOWER(p.first_name) LIKE ${`%${filters.search.toLowerCase()}%`} OR LOWER(p.last_name) LIKE ${`%${filters.search.toLowerCase()}%`} OR LOWER(u.email) LIKE ${`%${filters.search.toLowerCase()}%`})` : sql``}
    ${filters.role ? sql`AND u.role = ${filters.role}` : sql``}
    ${filters.is_active !== undefined ? sql`AND u.is_active = ${filters.is_active}` : sql``}
    ${filters.from ? sql`AND u.created_at >= ${filters.from}::timestamptz` : sql``}
    ${filters.to ? sql`AND u.created_at <= ${filters.to}::timestamptz` : sql``}
  `;
}

type UserListRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  first_name: string;
  last_name: string;
  created_at: string;
};

const USER_SORT_COLUMNS = {
  created_at: sql`u.created_at`,
  email: sql`u.email`,
  role: sql`u.role`,
  is_active: sql`u.is_active`,
};

export async function listUsers(
  db: DbClient,
  limit: number,
  offset: number,
  filters: UserFilters,
  sortBy: keyof typeof USER_SORT_COLUMNS = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const where = buildUserFilters(filters);
  const orderBy = USER_SORT_COLUMNS[sortBy] ?? USER_SORT_COLUMNS.created_at;
  const orderDir = sortDirection(sortOrder);

  const result = await db.execute<UserListRow>(sql`
    SELECT
      u.id, u.email, u.role, u.is_active, u.email_verified, u.mfa_enabled,
      p.first_name, p.last_name,
      u.created_at::text AS created_at
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE ${where}
    ORDER BY ${orderBy} ${orderDir}, u.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows: UserListRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows;
}

export async function countUsers(db: DbClient, filters: UserFilters) {
  type CountRow = { total: string };
  const where = buildUserFilters(filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function getUserDetail(db: DbClient, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      phone: users.phone,
      is_active: users.is_active,
      email_verified: users.email_verified,
      mfa_enabled: users.mfa_enabled,
      fcm_token: users.fcm_token,
      tos_accepted_at: users.tos_accepted_at,
      tos_version: users.tos_version,
      created_at: users.created_at,
      updated_at: users.updated_at,
      deleted_at: users.deleted_at,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      date_of_birth: profiles.date_of_birth,
      gender: profiles.gender,
      avatar_url: profiles.avatar_url,
      city: profiles.city,
      state: profiles.state,
      timezone: profiles.timezone,
      profile_updated_at: profiles.updated_at,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.user_id, users.id))
    .where(eq(users.id, userId));
  return row ?? null;
}

export async function updateUser(
  db: DbClient,
  userId: string,
  fields: {
    is_active?: boolean;
    role?: 'patient' | 'provider' | 'admin';
    force_password_reset?: boolean;
    force_mfa_reset?: boolean;
  },
) {
  const setFields: Record<string, unknown> = { updated_at: sql`NOW()` };
  if (fields.is_active !== undefined) setFields.is_active = fields.is_active;
  if (fields.role !== undefined) setFields.role = fields.role;
  if (fields.force_mfa_reset) {
    setFields.mfa_enabled = false;
    setFields.mfa_secret = null;
  }

  const [row] = await db
    .update(users)
    .set(setFields as Partial<typeof users.$inferInsert>)
    .where(eq(users.id, userId))
    .returning({ id: users.id, is_active: users.is_active, role: users.role });
  return row ?? null;
}

// ─── Audit logs ──────────────────────────────────────────────────────────────────

type AuditFilters = {
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
};

function buildAuditFilters(filters: AuditFilters) {
  return sql`
    TRUE
    ${filters.user_id ? sql`AND a.user_id = ${filters.user_id}` : sql``}
    ${filters.action ? sql`AND a.action = ${filters.action}` : sql``}
    ${filters.resource_type ? sql`AND a.resource_type = ${filters.resource_type}` : sql``}
    ${filters.from ? sql`AND a.created_at >= ${filters.from}::timestamptz` : sql``}
    ${filters.to ? sql`AND a.created_at <= ${filters.to}::timestamptz` : sql``}
  `;
}

export async function listAuditLogs(
  db: DbClient,
  limit: number,
  offset: number,
  filters: AuditFilters,
  sortBy: 'created_at' | 'action' | 'resource_type' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const where = buildAuditFilters(filters);
  const orderBy = {
    created_at: sql`a.created_at`,
    action: sql`a.action`,
    resource_type: sql`a.resource_type`,
  }[sortBy] ?? sql`a.created_at`;
  const orderDir = sortDirection(sortOrder);

  return db.execute(sql`
    SELECT
      a.id, a.user_id, a.action, a.resource_type, a.resource_id,
      a.ip_address, a.metadata,
      a.created_at::text AS created_at
    FROM audit_logs a
    WHERE ${where}
    ORDER BY ${orderBy} ${orderDir}, a.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countAuditLogs(db: DbClient, filters: AuditFilters) {
  type CountRow = { total: string };
  const where = buildAuditFilters(filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM audit_logs a WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

/**
 * streamAuditLogsForExport — Returns all audit logs in the date range.
 * Caller is responsible for enforcing the 90-day max (validated by Zod schema).
 */
export async function getAuditLogsForExport(
  db: DbClient,
  from: string,
  to: string,
) {
  return db.execute(sql`
    SELECT
      a.id, a.user_id, a.action, a.resource_type, a.resource_id,
      a.ip_address, a.user_agent, a.metadata,
      a.created_at::text AS created_at
    FROM audit_logs a
    WHERE a.created_at >= ${from}::timestamptz AND a.created_at <= ${to}::timestamptz
    ORDER BY a.created_at ASC
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

// ─── Login events ────────────────────────────────────────────────────────────────

type LoginEventFilters = {
  user_id?: string;
  success?: boolean;
  from?: string;
  to?: string;
};

function buildLoginEventFilters(filters: LoginEventFilters) {
  return sql`
    TRUE
    ${filters.user_id ? sql`AND le.user_id = ${filters.user_id}` : sql``}
    ${filters.success !== undefined ? sql`AND le.success = ${filters.success}` : sql``}
    ${filters.from ? sql`AND le.created_at >= ${filters.from}::timestamptz` : sql``}
    ${filters.to ? sql`AND le.created_at <= ${filters.to}::timestamptz` : sql``}
  `;
}

export async function listLoginEvents(
  db: DbClient,
  limit: number,
  offset: number,
  filters: LoginEventFilters,
  sortBy: 'created_at' | 'email' | 'success' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const where = buildLoginEventFilters(filters);
  const orderBy = {
    created_at: sql`le.created_at`,
    email: sql`le.email`,
    success: sql`le.success`,
  }[sortBy] ?? sql`le.created_at`;
  const orderDir = sortDirection(sortOrder);

  return db.execute(sql`
    SELECT
      le.id, le.user_id, le.email, le.success,
      le.ip_address, le.device_info, le.failure_reason,
      le.created_at::text AS created_at
    FROM login_events le
    WHERE ${where}
    ORDER BY ${orderBy} ${orderDir}, le.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countLoginEvents(db: DbClient, filters: LoginEventFilters) {
  type CountRow = { total: string };
  const where = buildLoginEventFilters(filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM login_events le WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ─── All reports (admin cross-provider view) ─────────────────────────────────────

export async function listAllReports(
  db: DbClient,
  limit: number,
  offset: number,
  sortBy: 'submitted_at' | 'urgency' | 'status' | 'pain_level' = 'submitted_at',
  sortOrder: SortOrder = 'desc',
) {
  const orderBy = {
    submitted_at: sql`r.submitted_at`,
    urgency: sql`r.urgency`,
    status: sql`r.status`,
    pain_level: sql`r.pain_level`,
  }[sortBy] ?? sql`r.submitted_at`;
  const orderDir = sortDirection(sortOrder);

  return db.execute(sql`
    SELECT
      r.id, r.patient_id, r.provider_id, r.urgency, r.status,
      r.pain_level, r.flagged,
      r.submitted_at::text AS submitted_at,
      pp.first_name AS patient_first_name,
      pp.last_name AS patient_last_name,
      prp.first_name AS provider_first_name,
      prp.last_name AS provider_last_name
    FROM reports r
    LEFT JOIN profiles pp ON pp.user_id = r.patient_id
    LEFT JOIN profiles prp ON prp.user_id = r.provider_id
    ORDER BY ${orderBy} ${orderDir}, r.submitted_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countAllReports(
  db: DbClient,
  filters?: { urgency?: string; status?: string; unanswered_over_hours?: number },
) {
  type CountRow = { total: string };
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM reports r
    WHERE TRUE
    ${filters?.urgency ? sql`AND r.urgency = ${filters.urgency}` : sql``}
    ${filters?.status ? sql`AND r.status = ${filters.status}` : sql``}
    ${filters?.unanswered_over_hours ? sql`AND r.status = 'submitted' AND r.submitted_at < NOW() - make_interval(hours => ${filters.unanswered_over_hours})` : sql``}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// Update listAllReports to accept filters
export async function listAllReportsFiltered(
  db: DbClient,
  limit: number,
  offset: number,
  filters?: { urgency?: string; status?: string; unanswered_over_hours?: number },
) {
  return db.execute(sql`
    SELECT
      r.id, r.patient_id, r.provider_id, r.urgency, r.status,
      r.pain_level, r.flagged,
      r.submitted_at::text AS submitted_at,
      pp.first_name AS patient_first_name,
      pp.last_name AS patient_last_name,
      prp.first_name AS provider_first_name,
      prp.last_name AS provider_last_name
    FROM reports r
    LEFT JOIN profiles pp ON pp.user_id = r.patient_id
    LEFT JOIN profiles prp ON prp.user_id = r.provider_id
    WHERE TRUE
    ${filters?.urgency ? sql`AND r.urgency = ${filters.urgency}` : sql``}
    ${filters?.status ? sql`AND r.status = ${filters.status}` : sql``}
    ${filters?.unanswered_over_hours ? sql`AND r.status = 'submitted' AND r.submitted_at < NOW() - make_interval(hours => ${filters.unanswered_over_hours})` : sql``}
    ORDER BY r.submitted_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

// ─── TODO #4: Extended stats (urgent reports waiting) ───────────────────────────

export async function getExtendedAdminStats(db: DbClient) {
  type Row = {
    urgent_reports_waiting: string;
    urgent_reports_waiting_critical: string;
    pending_reports_total: string;
  };

  const [row] = await db.execute<Row>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM reports
       WHERE urgency = 'urgent' AND status = 'submitted'
         AND submitted_at < NOW() - INTERVAL '1 hour') AS urgent_reports_waiting,
      (SELECT COUNT(*)::text FROM reports
       WHERE urgency = 'urgent' AND status = 'submitted'
         AND submitted_at < NOW() - INTERVAL '4 hours') AS urgent_reports_waiting_critical,
      (SELECT COUNT(*)::text FROM reports
       WHERE status = 'submitted') AS pending_reports_total
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows;
  });

  return {
    urgent_reports_waiting: parseInt(row?.urgent_reports_waiting ?? '0', 10),
    urgent_reports_waiting_critical: parseInt(row?.urgent_reports_waiting_critical ?? '0', 10),
    pending_reports_total: parseInt(row?.pending_reports_total ?? '0', 10),
  };
}

// ─── TODO #1: Notification outbox monitor ───────────────────────────────────────

type OutboxStatsRow = {
  pending: string;
  dlq: string;
  sent_24h: string;
  failed_24h: string;
};

type ChannelStatsRow = {
  channel: string;
  pending: string;
  sent_24h: string;
  dlq: string;
};

type HourlyVolumeRow = {
  hour: string;
  sent: string;
  failed: string;
};

export async function getOutboxStats(db: DbClient) {
  const [totals] = await db.execute<OutboxStatsRow>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM notification_outbox WHERE sent_at IS NULL AND attempts < max_attempts) AS pending,
      (SELECT COUNT(*)::text FROM notification_outbox WHERE sent_at IS NULL AND attempts >= max_attempts) AS dlq,
      (SELECT COUNT(*)::text FROM notification_outbox WHERE sent_at IS NOT NULL AND sent_at >= NOW() - INTERVAL '24 hours') AS sent_24h,
      (SELECT COUNT(*)::text FROM notification_outbox WHERE sent_at IS NULL AND attempts >= max_attempts AND created_at >= NOW() - INTERVAL '24 hours') AS failed_24h
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const channelRows = await db.execute<ChannelStatsRow>(sql`
    SELECT
      channel::text AS channel,
      COUNT(*) FILTER (WHERE sent_at IS NULL AND attempts < max_attempts)::text AS pending,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL AND sent_at >= NOW() - INTERVAL '24 hours')::text AS sent_24h,
      COUNT(*) FILTER (WHERE sent_at IS NULL AND attempts >= max_attempts)::text AS dlq
    FROM notification_outbox
    GROUP BY channel
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const hourlyRows = await db.execute<HourlyVolumeRow>(sql`
    SELECT
      to_char(date_trunc('hour', created_at), 'YYYY-MM-DD"T"HH24:00') AS hour,
      COUNT(*) FILTER (WHERE sent_at IS NOT NULL)::text AS sent,
      COUNT(*) FILTER (WHERE sent_at IS NULL AND attempts >= max_attempts)::text AS failed
    FROM notification_outbox
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY date_trunc('hour', created_at)
    ORDER BY date_trunc('hour', created_at)
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const byChannel: Record<string, { pending: number; sent_24h: number; dlq: number }> = {};
  for (const ch of channelRows) {
    byChannel[ch.channel] = {
      pending: parseInt(ch.pending, 10),
      sent_24h: parseInt(ch.sent_24h, 10),
      dlq: parseInt(ch.dlq, 10),
    };
  }

  return {
    pending: parseInt(totals?.pending ?? '0', 10),
    dlq: parseInt(totals?.dlq ?? '0', 10),
    sent_24h: parseInt(totals?.sent_24h ?? '0', 10),
    failed_24h: parseInt(totals?.failed_24h ?? '0', 10),
    by_channel: byChannel,
    hourly_volume: hourlyRows.map((r) => ({
      hour: r.hour,
      sent: parseInt(r.sent, 10),
      failed: parseInt(r.failed, 10),
    })),
  };
}

export async function listOutboxDlq(
  db: DbClient,
  limit: number,
  offset: number,
  channel?: string,
  sortBy: 'created_at' | 'next_attempt_at' | 'attempts' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const orderBy = {
    created_at: sql`created_at`,
    next_attempt_at: sql`next_attempt_at`,
    attempts: sql`attempts`,
  }[sortBy] ?? sql`created_at`;
  const orderDir = sortDirection(sortOrder);
  return db.execute(sql`
    SELECT id, user_id, channel::text, type, payload, attempts, max_attempts,
           next_attempt_at::text, last_error, created_at::text
    FROM notification_outbox
    WHERE sent_at IS NULL AND attempts >= max_attempts
    ${channel ? sql`AND channel = ${channel}` : sql``}
    ORDER BY ${orderBy} ${orderDir}, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countOutboxDlq(db: DbClient, channel?: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM notification_outbox
    WHERE sent_at IS NULL AND attempts >= max_attempts
    ${channel ? sql`AND channel = ${channel}` : sql``}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function listOutboxPending(
  db: DbClient,
  limit: number,
  offset: number,
  channel?: string,
  sortBy: 'created_at' | 'next_attempt_at' | 'attempts' = 'next_attempt_at',
  sortOrder: SortOrder = 'asc',
) {
  const orderBy = {
    created_at: sql`created_at`,
    next_attempt_at: sql`next_attempt_at`,
    attempts: sql`attempts`,
  }[sortBy] ?? sql`next_attempt_at`;
  const orderDir = sortDirection(sortOrder);
  return db.execute(sql`
    SELECT id, user_id, channel::text, type, payload, attempts, max_attempts,
           next_attempt_at::text, last_error, created_at::text
    FROM notification_outbox
    WHERE sent_at IS NULL AND attempts < max_attempts
    ${channel ? sql`AND channel = ${channel}` : sql``}
    ORDER BY ${orderBy} ${orderDir}, next_attempt_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countOutboxPending(db: DbClient, channel?: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM notification_outbox
    WHERE sent_at IS NULL AND attempts < max_attempts
    ${channel ? sql`AND channel = ${channel}` : sql``}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function listOutboxRecent(
  db: DbClient,
  limit: number,
  offset: number,
  channel?: string,
  sortBy: 'created_at' | 'next_attempt_at' | 'attempts' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const orderBy = {
    created_at: sql`created_at`,
    next_attempt_at: sql`next_attempt_at`,
    attempts: sql`attempts`,
  }[sortBy] ?? sql`created_at`;
  const orderDir = sortDirection(sortOrder);
  return db.execute(sql`
    SELECT id, user_id, channel::text, type, payload, attempts, max_attempts,
           next_attempt_at::text, sent_at::text, last_error, created_at::text
    FROM notification_outbox
    WHERE TRUE
    ${channel ? sql`AND channel = ${channel}` : sql``}
    ORDER BY ${orderBy} ${orderDir}, created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countOutboxRecent(db: DbClient, channel?: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM notification_outbox
    WHERE TRUE
    ${channel ? sql`AND channel = ${channel}` : sql``}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function retryOutboxEntry(db: DbClient, id: string) {
  return db.execute(sql`
    UPDATE notification_outbox
    SET attempts = 0, next_attempt_at = NOW(), last_error = NULL
    WHERE id = ${id} AND sent_at IS NULL
    RETURNING id
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows.length > 0;
  });
}

export async function dropOutboxEntry(db: DbClient, id: string) {
  return db.execute(sql`
    DELETE FROM notification_outbox WHERE id = ${id} AND sent_at IS NULL
    RETURNING id
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows.length > 0;
  });
}

// ─── TODO #2: Active sessions ───────────────────────────────────────────────────

type SessionRow = {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  ip_address: string | null;
  device_info: string | null;
  last_active: string;
  created_at: string;
};

export async function listActiveSessions(
  db: DbClient,
  limit: number,
  offset: number,
  role?: string,
  sortBy: 'last_active' | 'created_at' | 'user_email' | 'user_role' = 'last_active',
  sortOrder: SortOrder = 'desc',
) {
  const orderBy = {
    last_active: sql`s.last_active`,
    created_at: sql`s.created_at`,
    user_email: sql`u.email`,
    user_role: sql`u.role`,
  }[sortBy] ?? sql`s.last_active`;
  const orderDir = sortDirection(sortOrder);
  return db.execute<SessionRow>(sql`
    SELECT
      s.id, s.user_id, u.email AS user_email, u.role AS user_role,
      s.ip_address::text, s.device_info,
      s.last_active::text AS last_active, s.created_at::text AS created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > NOW()
    ${role ? sql`AND u.role = ${role}` : sql``}
    ORDER BY ${orderBy} ${orderDir}, s.last_active DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countActiveSessions(db: DbClient, role?: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > NOW()
    ${role ? sql`AND u.role = ${role}` : sql``}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

type SessionSummary = {
  total_active: string;
  patients: string;
  providers: string;
  admins: string;
};

export async function getSessionSummary(db: DbClient) {
  const [row] = await db.execute<SessionSummary>(sql`
    SELECT
      COUNT(*)::text AS total_active,
      COUNT(*) FILTER (WHERE u.role = 'patient')::text AS patients,
      COUNT(*) FILTER (WHERE u.role = 'provider')::text AS providers,
      COUNT(*) FILTER (WHERE u.role = 'admin')::text AS admins
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.last_active > NOW() - INTERVAL '15 minutes'
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  return {
    total_active: parseInt(row?.total_active ?? '0', 10),
    by_role: {
      patient: parseInt(row?.patients ?? '0', 10),
      provider: parseInt(row?.providers ?? '0', 10),
      admin: parseInt(row?.admins ?? '0', 10),
    },
  };
}

export async function deleteSession(db: DbClient, sessionId: string) {
  return db.execute(sql`
    DELETE FROM sessions WHERE id = ${sessionId} RETURNING id
  `).then((r) => {
    const rows = Array.isArray(r) ? r : r.rows ?? [];
    return rows.length > 0;
  });
}

// ─── TODO #3: Job runner health ─────────────────────────────────────────────────

type JobSummaryRow = {
  job_name: string;
  last_status: string | null;
  last_started_at: string | null;
  last_duration_ms: string | null;
  last_rows_affected: string | null;
  last_error_message: string | null;
  last_success_at: string | null;
  success_rate_24h: string;
  avg_duration_ms_7d: string;
};

/** Job schedule metadata — maintained here so the API response includes the cron expression. */
const JOB_SCHEDULES: Record<string, string> = {
  reminderJob: '* * * * *',
  codeExpiryJob: '0 * * * *',
  weeklyDigestJob: '5 * * * *',
  cleanupJob: '0 3 * * *',
  orphanFileCleanupJob: '0 4 * * *',
  outboxJob: '* * * * *',
  scheduledBroadcastJob: '* * * * *',
};

export async function getJobSummaries(db: DbClient) {
  const rows = await db.execute<JobSummaryRow>(sql`
    WITH latest AS (
      SELECT DISTINCT ON (job_name) job_name, status, started_at, duration_ms, rows_affected, error_message
      FROM job_runs
      ORDER BY job_name, started_at DESC
    ),
    success_latest AS (
      SELECT DISTINCT ON (job_name) job_name, started_at AS last_success_at
      FROM job_runs
      WHERE status = 'success'
      ORDER BY job_name, started_at DESC
    ),
    stats_24h AS (
      SELECT
        job_name,
        ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0), 2)::text AS success_rate_24h
      FROM job_runs
      WHERE started_at >= NOW() - INTERVAL '24 hours'
      GROUP BY job_name
    ),
    avg_7d AS (
      SELECT
        job_name,
        ROUND(AVG(duration_ms))::text AS avg_duration_ms_7d
      FROM job_runs
      WHERE started_at >= NOW() - INTERVAL '7 days' AND status = 'success'
      GROUP BY job_name
    )
    SELECT
      l.job_name,
      l.status::text AS last_status,
      l.started_at::text AS last_started_at,
      l.duration_ms::text AS last_duration_ms,
      l.rows_affected::text AS last_rows_affected,
      l.error_message AS last_error_message,
      sl.last_success_at::text AS last_success_at,
      COALESCE(s.success_rate_24h, '0') AS success_rate_24h,
      COALESCE(a.avg_duration_ms_7d, '0') AS avg_duration_ms_7d
    FROM latest l
    LEFT JOIN success_latest sl ON sl.job_name = l.job_name
    LEFT JOIN stats_24h s ON s.job_name = l.job_name
    LEFT JOIN avg_7d a ON a.job_name = l.job_name
    ORDER BY l.job_name
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);

  const byJob = new Map(rows.map((r) => [r.job_name, r]));
  const configuredJobNames = Object.keys(JOB_SCHEDULES);
  const unknownJobNames = rows
    .map((r) => r.job_name)
    .filter((jobName) => !JOB_SCHEDULES[jobName]);

  return [...configuredJobNames, ...unknownJobNames].map((jobName) => {
    const r = byJob.get(jobName);
    return {
      job_name: jobName,
      schedule: JOB_SCHEDULES[jobName] ?? 'unknown',
      last_run: r?.last_status
        ? {
            status: r.last_status,
            started_at: r.last_started_at,
            duration_ms: r.last_duration_ms ? parseInt(r.last_duration_ms, 10) : null,
            rows_affected: r.last_rows_affected ? parseInt(r.last_rows_affected, 10) : null,
            error_message: r.last_error_message,
          }
        : null,
      last_success_at: r?.last_success_at ?? null,
      success_rate_24h: r ? parseFloat(r.success_rate_24h) : 0,
      avg_duration_ms_7d: r ? parseInt(r.avg_duration_ms_7d, 10) : 0,
    };
  });
}

export async function listJobHistory(
  db: DbClient,
  jobName: string,
  limit: number,
  offset: number,
  sortBy: 'started_at' | 'status' | 'duration_ms' = 'started_at',
  sortOrder: SortOrder = 'desc',
) {
  const orderBy = {
    started_at: sql`started_at`,
    status: sql`status`,
    duration_ms: sql`duration_ms`,
  }[sortBy] ?? sql`started_at`;
  const orderDir = sortDirection(sortOrder);
  return db.execute(sql`
    SELECT id, job_name, status::text, started_at::text, finished_at::text,
           duration_ms, rows_affected, error_message, metadata
    FROM job_runs
    WHERE job_name = ${jobName}
    ORDER BY ${orderBy} ${orderDir}, started_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countJobHistory(db: DbClient, jobName: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM job_runs WHERE job_name = ${jobName}
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

/** Insert a running job record; returns the row id for later update. */
export async function insertJobRun(
  db: DbClient,
  jobName: string,
) {
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO job_runs (job_name, status) VALUES (${jobName}, 'running')
    RETURNING id
  `);
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return rows[0]?.id ?? null;
}

export async function completeJobRun(
  db: DbClient,
  id: string,
  status: 'success' | 'failed' | 'skipped',
  durationMs: number,
  rowsAffected?: number,
  errorMessage?: string,
) {
  return db.execute(sql`
    UPDATE job_runs
    SET status = ${status}, finished_at = NOW(), duration_ms = ${durationMs},
        rows_affected = ${rowsAffected ?? null}, error_message = ${errorMessage ?? null}
    WHERE id = ${id}
  `);
}
