import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { accountRestoreRequests, profiles, users } from '../schema';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

export type AccountRestoreStatus = 'pending' | 'approved' | 'rejected';

export async function findDeletedUserForRestoreRequest(db: DbClient, email: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      deleted_at: users.deleted_at,
    })
    .from(users)
    .where(and(
      eq(sql`LOWER(${users.email})`, email.toLowerCase()),
      sql`${users.deleted_at} IS NOT NULL`,
    ))
    .limit(1);
  return row ?? null;
}

export async function findPendingRestoreRequest(db: DbClient, userId: string) {
  const [row] = await db
    .select({ id: accountRestoreRequests.id })
    .from(accountRestoreRequests)
    .where(and(
      eq(accountRestoreRequests.user_id, userId),
      eq(accountRestoreRequests.status, 'pending'),
    ))
    .limit(1);
  return row ?? null;
}

export async function insertRestoreRequest(
  db: DbClient,
  data: { user_id: string; email: string; role: string; reason?: string },
) {
  const [row] = await db
    .insert(accountRestoreRequests)
    .values(data)
    .returning();
  return row;
}

type RestoreRequestFilters = {
  status?: AccountRestoreStatus;
  role?: 'patient' | 'provider' | 'admin';
  search?: string;
};

function buildRestoreRequestFilters(filters: RestoreRequestFilters) {
  return sql`
    true
    ${filters.status ? sql`AND arr.status = ${filters.status}` : sql``}
    ${filters.role ? sql`AND arr.role = ${filters.role}` : sql``}
    ${filters.search ? sql`AND LOWER(arr.email) LIKE ${`%${filters.search.toLowerCase()}%`}` : sql``}
  `;
}

const SORT_COLUMNS = {
  requested_at: sql`arr.requested_at`,
  reviewed_at: sql`arr.reviewed_at`,
  email: sql`arr.email`,
  status: sql`arr.status`,
};

export async function listRestoreRequests(
  db: DbClient,
  limit: number,
  offset: number,
  filters: RestoreRequestFilters,
  sortBy: keyof typeof SORT_COLUMNS = 'requested_at',
  sortOrder: SortOrder = 'desc',
) {
  const where = buildRestoreRequestFilters(filters);
  const orderBy = SORT_COLUMNS[sortBy] ?? SORT_COLUMNS.requested_at;
  const orderDir = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
  type Row = {
    id: string;
    user_id: string | null;
    email: string;
    role: string;
    status: AccountRestoreStatus;
    reason: string | null;
    requested_at: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    decision_note: string | null;
    first_name: string | null;
    last_name: string | null;
    deleted_at: string | null;
  };
  const result = await db.execute<Row>(sql`
    SELECT
      arr.id, arr.user_id, arr.email, arr.role, arr.status, arr.reason,
      arr.requested_at::text, arr.reviewed_at::text, arr.reviewed_by, arr.decision_note,
      p.first_name, p.last_name, u.deleted_at::text AS deleted_at
    FROM account_restore_requests arr
    LEFT JOIN users u ON u.id = arr.user_id
    LEFT JOIN profiles p ON p.user_id = arr.user_id
    WHERE ${where}
    ORDER BY ${orderBy} ${orderDir} NULLS LAST, arr.requested_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  return Array.isArray(result) ? result : result.rows ?? [];
}

export async function countRestoreRequests(db: DbClient, filters: RestoreRequestFilters) {
  type Row = { total: string };
  const where = buildRestoreRequestFilters(filters);
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM account_restore_requests arr WHERE ${where}
  `);
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function approveRestoreRequest(db: DbClient, requestId: string, adminId: string, decisionNote?: string) {
  return db.transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: accountRestoreRequests.id,
        user_id: accountRestoreRequests.user_id,
        status: accountRestoreRequests.status,
      })
      .from(accountRestoreRequests)
      .where(eq(accountRestoreRequests.id, requestId))
      .for('update')
      .limit(1);
    if (!request || !request.user_id || request.status !== 'pending') return null;

    await tx
      .update(users)
      .set({ deleted_at: null, updated_at: sql`NOW()` })
      .where(eq(users.id, request.user_id));

    const [row] = await tx
      .update(accountRestoreRequests)
      .set({ status: 'approved', reviewed_at: sql`NOW()`, reviewed_by: adminId, decision_note: decisionNote })
      .where(eq(accountRestoreRequests.id, requestId))
      .returning();
    return row ?? null;
  });
}

export async function rejectRestoreRequest(db: DbClient, requestId: string, adminId: string, decisionNote?: string) {
  const [row] = await db
    .update(accountRestoreRequests)
    .set({ status: 'rejected', reviewed_at: sql`NOW()`, reviewed_by: adminId, decision_note: decisionNote })
    .where(and(eq(accountRestoreRequests.id, requestId), eq(accountRestoreRequests.status, 'pending')))
    .returning();
  return row ?? null;
}

export async function getRestoreRequestUser(db: DbClient, requestId: string) {
  const [row] = await db
    .select({
      email: accountRestoreRequests.email,
      first_name: profiles.first_name,
    })
    .from(accountRestoreRequests)
    .leftJoin(profiles, eq(profiles.user_id, accountRestoreRequests.user_id))
    .where(eq(accountRestoreRequests.id, requestId))
    .limit(1);
  return row ?? null;
}
