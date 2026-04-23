import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reportRequests } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];

export async function listRequestsByProvider(
  db: DbClient,
  provider: ScopedUser,
  status?: 'pending' | 'fulfilled' | 'dismissed',
) {
  const baseCondition = status ? eq(reportRequests.status, status) : undefined;
  return db
    .select()
    .from(reportRequests)
    .where(scopeToUser(baseCondition, reportRequests, provider))
    .orderBy(desc(reportRequests.created_at));
}

export async function listRequestsForPatientByProvider(
  db: DbClient,
  patientId: string,
  provider: ScopedUser,
) {
  return db
    .select()
    .from(reportRequests)
    .where(scopeToUser(eq(reportRequests.patient_id, patientId), reportRequests, provider))
    .orderBy(desc(reportRequests.created_at));
}

export async function listPendingRequestsForPatient(db: DbClient, patient: ScopedUser) {
  return db
    .select()
    .from(reportRequests)
    .where(scopeToUser(eq(reportRequests.status, 'pending'), reportRequests, patient))
    .orderBy(desc(reportRequests.created_at));
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
