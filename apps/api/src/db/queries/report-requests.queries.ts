import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reportRequests } from '../schema';

type DbClient = Db['db'];

export async function listRequestsByProvider(
  db: DbClient,
  providerId: string,
  status?: 'pending' | 'fulfilled' | 'dismissed',
) {
  if (status) {
    return db
      .select()
      .from(reportRequests)
      .where(and(eq(reportRequests.provider_id, providerId), eq(reportRequests.status, status)))
      .orderBy(desc(reportRequests.created_at));
  }
  return db
    .select()
    .from(reportRequests)
    .where(eq(reportRequests.provider_id, providerId))
    .orderBy(desc(reportRequests.created_at));
}

export async function listRequestsForPatientByProvider(
  db: DbClient,
  patientId: string,
  providerId: string,
) {
  return db
    .select()
    .from(reportRequests)
    .where(and(eq(reportRequests.patient_id, patientId), eq(reportRequests.provider_id, providerId)))
    .orderBy(desc(reportRequests.created_at));
}

export async function listPendingRequestsForPatient(db: DbClient, patientId: string) {
  return db
    .select()
    .from(reportRequests)
    .where(and(eq(reportRequests.patient_id, patientId), eq(reportRequests.status, 'pending')))
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
