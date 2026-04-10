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
} from '../schema';

type DbClient = Db['db'];

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

export async function listUsers(
  db: DbClient,
  page: number,
  limit: number,
  filters: UserFilters,
) {
  const offset = (page - 1) * limit;
  const where = buildUserFilters(filters);

  const result = await db.execute<UserListRow>(sql`
    SELECT
      u.id, u.email, u.role, u.is_active, u.email_verified, u.mfa_enabled,
      p.first_name, p.last_name,
      u.created_at::text AS created_at
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE ${where}
    ORDER BY u.created_at DESC
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
      created_at: users.created_at,
      updated_at: users.updated_at,
      deleted_at: users.deleted_at,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      date_of_birth: profiles.date_of_birth,
      gender: profiles.gender,
      city: profiles.city,
      state: profiles.state,
      timezone: profiles.timezone,
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
  page: number,
  limit: number,
  filters: AuditFilters,
) {
  const offset = (page - 1) * limit;
  const where = buildAuditFilters(filters);

  return db.execute(sql`
    SELECT
      a.id, a.user_id, a.action, a.resource_type, a.resource_id,
      a.ip_address, a.metadata,
      a.created_at::text AS created_at
    FROM audit_logs a
    WHERE ${where}
    ORDER BY a.created_at DESC
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
  page: number,
  limit: number,
  filters: LoginEventFilters,
) {
  const offset = (page - 1) * limit;
  const where = buildLoginEventFilters(filters);

  return db.execute(sql`
    SELECT
      le.id, le.user_id, le.email, le.success,
      le.ip_address, le.device_info, le.failure_reason,
      le.created_at::text AS created_at
    FROM login_events le
    WHERE ${where}
    ORDER BY le.created_at DESC
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
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

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
    ORDER BY r.submitted_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `).then((r) => Array.isArray(r) ? r : r.rows ?? []);
}

export async function countAllReports(db: DbClient) {
  type CountRow = { total: string };
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM reports
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}
