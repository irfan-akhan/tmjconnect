/**
 * clinic-visits.queries.ts — DB access for the clinic_visits table.
 *
 * Visits are provider-authored. Scope checks (provider must be actively linked
 * to the patient) live in the use-case layer; this file is a thin DB shim.
 */
import { desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { clinicVisits } from '../schema';

type DbClient = Db['db'];

export type ClinicVisit = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  visited_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Returns the patient's most recent clinic visit, or null if none exists. */
export async function getLastClinicVisitForPatient(
  db: DbClient,
  patientId: string,
): Promise<ClinicVisit | null> {
  const [row] = await db
    .select({
      id: clinicVisits.id,
      patient_id: clinicVisits.patient_id,
      provider_id: clinicVisits.provider_id,
      visited_at: sql<string>`${clinicVisits.visited_at}::text`,
      notes: clinicVisits.notes,
      created_at: sql<string>`${clinicVisits.created_at}::text`,
      updated_at: sql<string>`${clinicVisits.updated_at}::text`,
    })
    .from(clinicVisits)
    .where(eq(clinicVisits.patient_id, patientId))
    .orderBy(desc(clinicVisits.visited_at))
    .limit(1);
  return row ?? null;
}

export async function insertClinicVisit(
  db: DbClient,
  data: { patient_id: string; provider_id: string; visited_at: string; notes: string | null },
): Promise<ClinicVisit> {
  const [row] = await db
    .insert(clinicVisits)
    .values({
      patient_id: data.patient_id,
      provider_id: data.provider_id,
      visited_at: new Date(data.visited_at),
      notes: data.notes,
    })
    .returning({
      id: clinicVisits.id,
      patient_id: clinicVisits.patient_id,
      provider_id: clinicVisits.provider_id,
      visited_at: sql<string>`${clinicVisits.visited_at}::text`,
      notes: clinicVisits.notes,
      created_at: sql<string>`${clinicVisits.created_at}::text`,
      updated_at: sql<string>`${clinicVisits.updated_at}::text`,
    });
  return row;
}
