import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reportRequests } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

function reportRequestOrder(sortBy: 'created_at' | 'status' = 'created_at', sortOrder: SortOrder = 'desc') {
  const column = sortBy === 'status' ? reportRequests.status : reportRequests.created_at;
  return sortOrder === 'asc' ? asc(column) : desc(column);
}

export async function listRequestsByProvider(
  db: DbClient,
  provider: ScopedUser,
  status?: 'pending' | 'fulfilled' | 'dismissed',
  limit = 10,
  offset = 0,
  sortBy: 'created_at' | 'status' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const baseCondition = status ? eq(reportRequests.status, status) : undefined;
  return db
    .select()
    .from(reportRequests)
    .where(scopeToUser(baseCondition, reportRequests, provider))
    .orderBy(reportRequestOrder(sortBy, sortOrder), desc(reportRequests.created_at))
    .limit(limit)
    .offset(offset);
}

export async function listRequestsForPatientByProvider(
  db: DbClient,
  patientId: string,
  provider: ScopedUser,
  limit = 10,
  offset = 0,
  sortBy: 'created_at' | 'status' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  return db
    .select()
    .from(reportRequests)
    .where(scopeToUser(eq(reportRequests.patient_id, patientId), reportRequests, provider))
    .orderBy(reportRequestOrder(sortBy, sortOrder), desc(reportRequests.created_at))
    .limit(limit)
    .offset(offset);
}

export async function listPendingRequestsForPatient(db: DbClient, patient: ScopedUser) {
  type Row = typeof reportRequests.$inferSelect & {
    provider_first_name: string;
    provider_last_name: string;
    provider_avatar_url: string | null;
    provider_email: string;
    provider_license_type: string;
    provider_specialty: string;
    provider_clinic_name: string;
    provider_credentials: string[] | null;
  };
  const result = await db.execute<Row>(sql`
    SELECT
      rr.*,
      p.first_name AS provider_first_name,
      p.last_name AS provider_last_name,
      p.avatar_url AS provider_avatar_url,
      u.email AS provider_email,
      pd.license_type AS provider_license_type,
      pd.specialty AS provider_specialty,
      pd.clinic_name AS provider_clinic_name,
      pd.credentials AS provider_credentials
    FROM report_requests rr
    JOIN profiles p ON p.user_id = rr.provider_id
    JOIN users u ON u.id = rr.provider_id
    JOIN provider_details pd ON pd.user_id = rr.provider_id
    WHERE rr.patient_id = ${patient.id} AND rr.status = 'pending'
    ORDER BY rr.created_at DESC
  `);
  return Array.isArray(result) ? result : result.rows ?? [];
}

export async function insertRequest(
  db: DbClient,
  data: { provider_id: string; patient_id: string; prompt: string },
) {
  const [row] = await db.insert(reportRequests).values(data).returning();
  return row;
}

export async function findRequestById(db: DbClient, id: string) {
  const [row] = await db.select().from(reportRequests).where(eq(reportRequests.id, id)).limit(1);
  return row ?? null;
}

export async function dismissRequest(db: DbClient, id: string) {
  const [row] = await db
    .update(reportRequests)
    .set({ status: 'dismissed', dismissed_at: sql`NOW()` })
    .where(and(eq(reportRequests.id, id), eq(reportRequests.status, 'pending')))
    .returning();
  return row ?? null;
}

export async function fulfillRequest(db: DbClient, id: string, reportId: string) {
  const [row] = await db
    .update(reportRequests)
    .set({ status: 'fulfilled', fulfilled_at: sql`NOW()`, fulfilled_report_id: reportId })
    .where(and(eq(reportRequests.id, id), eq(reportRequests.status, 'pending')))
    .returning();
  return row ?? null;
}
