/**
 * Clinical notes are PROVIDER-PRIVATE PHI. Routes must gate access with
 * `authorize('provider')` — patients must never reach these queries. All
 * ownership scoping uses scopeToUser with a provider role (which picks
 * provider_id); if this file is ever reused for a patient-accessible path,
 * replace scopeToUser with an explicit patient_id filter.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { clinicalNotes } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

export async function listNotesForPatient(
  db: DbClient,
  patientId: string,
  provider: ScopedUser,
  limit: number,
  offset: number,
  sortBy: 'created_at' | 'updated_at' = 'created_at',
  sortOrder: SortOrder = 'desc',
) {
  const column = sortBy === 'updated_at' ? clinicalNotes.updated_at : clinicalNotes.created_at;
  const orderBy = sortOrder === 'asc' ? asc(column) : desc(column);

  return db
    .select()
    .from(clinicalNotes)
    .where(scopeToUser(eq(clinicalNotes.patient_id, patientId), clinicalNotes, provider))
    .orderBy(orderBy, desc(clinicalNotes.created_at))
    .limit(limit)
    .offset(offset);
}

export async function countNotesForPatient(db: DbClient, patientId: string, providerId: string) {
  // Kept as raw SQL for count aggregate. providerId is trusted (comes from req.user.id
  // via a provider-gated route). If generalised, convert to Drizzle builder + scopeToUser.
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

export async function findNoteById(db: DbClient, id: string, provider: ScopedUser) {
  const [row] = await db
    .select()
    .from(clinicalNotes)
    .where(scopeToUser(eq(clinicalNotes.id, id), clinicalNotes, provider))
    .limit(1);
  return row ?? null;
}

export async function updateNote(
  db: DbClient,
  id: string,
  provider: ScopedUser,
  fields: { body?: string; tags?: string[] },
) {
  const set: Record<string, unknown> = { updated_at: sql`NOW()` };
  if (fields.body !== undefined) set.body = fields.body;
  if (fields.tags !== undefined) set.tags = fields.tags;
  const [row] = await db
    .update(clinicalNotes)
    .set(set)
    .where(scopeToUser(eq(clinicalNotes.id, id), clinicalNotes, provider))
    .returning();
  return row ?? null;
}

export async function deleteNote(db: DbClient, id: string, provider: ScopedUser) {
  const result = await db
    .delete(clinicalNotes)
    .where(scopeToUser(eq(clinicalNotes.id, id), clinicalNotes, provider))
    .returning({ id: clinicalNotes.id });
  return result.length > 0;
}
