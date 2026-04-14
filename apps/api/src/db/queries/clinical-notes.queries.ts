import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { clinicalNotes } from '../schema';

type DbClient = Db['db'];

export async function listNotesForPatient(
  db: DbClient,
  patientId: string,
  providerId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(clinicalNotes)
    .where(and(eq(clinicalNotes.patient_id, patientId), eq(clinicalNotes.provider_id, providerId)))
    .orderBy(desc(clinicalNotes.created_at))
    .limit(limit)
    .offset(offset);
}

export async function countNotesForPatient(db: DbClient, patientId: string, providerId: string) {
  type Row = { total: string };
  const result = await db.execute<Row>(sql`
    SELECT COUNT(*)::text AS total FROM clinical_notes
    WHERE patient_id = ${patientId} AND provider_id = ${providerId}
  `);
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function insertNote(
  db: DbClient,
  data: { patient_id: string; provider_id: string; body: string; tags: string[] },
) {
  const [row] = await db.insert(clinicalNotes).values(data).returning();
  return row;
}

export async function findNoteById(db: DbClient, id: string, providerId: string) {
  const [row] = await db
    .select()
    .from(clinicalNotes)
    .where(and(eq(clinicalNotes.id, id), eq(clinicalNotes.provider_id, providerId)))
    .limit(1);
  return row ?? null;
}

export async function updateNote(
  db: DbClient,
  id: string,
  providerId: string,
  fields: { body?: string; tags?: string[] },
) {
  const set: Record<string, unknown> = { updated_at: sql`NOW()` };
  if (fields.body !== undefined) set.body = fields.body;
  if (fields.tags !== undefined) set.tags = fields.tags;
  const [row] = await db
    .update(clinicalNotes)
    .set(set)
    .where(and(eq(clinicalNotes.id, id), eq(clinicalNotes.provider_id, providerId)))
    .returning();
  return row ?? null;
}

export async function deleteNote(db: DbClient, id: string, providerId: string) {
  const result = await db
    .delete(clinicalNotes)
    .where(and(eq(clinicalNotes.id, id), eq(clinicalNotes.provider_id, providerId)))
    .returning({ id: clinicalNotes.id });
  return result.length > 0;
}
