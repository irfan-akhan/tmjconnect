/**
 * providers.queries.ts — All database interactions for the providers module.
 * All patient data queries enforce link check via patientProviderLinks.
 */
import { eq, and, isNull, desc, sql, like, or } from 'drizzle-orm';
import type { Db } from '../../config/database';
import {
  users,
  profiles,
  providerDetails,
  patientProviderLinks,
  symptomLogs,
  exerciseAssignments,
  exerciseCompletions,
  exercises,
} from '../schema';

type DbClient = Db['db'];

// ─── Provider profile ────────────────────────────────────────────────────────────

export async function getProviderWithProfile(db: DbClient, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
      is_active: users.is_active,
      created_at: users.created_at,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      avatar_url: profiles.avatar_url,
      city: profiles.city,
      state: profiles.state,
      timezone: profiles.timezone,
      license_number: providerDetails.license_number,
      license_type: providerDetails.license_type,
      specialty: providerDetails.specialty,
      clinic_name: providerDetails.clinic_name,
      credentials: providerDetails.credentials,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.user_id))
    .innerJoin(providerDetails, eq(users.id, providerDetails.user_id))
    .where(and(eq(users.id, userId), isNull(users.deleted_at)));
  return row ?? null;
}

export async function updateProviderProfile(
  db: DbClient,
  userId: string,
  profileFields: {
    first_name?: string;
    last_name?: string;
    city?: string | null;
    state?: string | null;
    timezone?: string;
    avatar_url?: string | null;
  },
  providerFields: {
    license_number?: string;
    license_type?: string;
    specialty?: string;
    clinic_name?: string;
    credentials?: string[] | null;
  },
) {
  await db.transaction(async (tx) => {
    const pf = Object.fromEntries(
      Object.entries(profileFields).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(pf).length > 0) {
      await tx.update(profiles)
        .set({ ...pf, updated_at: sql`NOW()` })
        .where(eq(profiles.user_id, userId));
    }

    const pd = Object.fromEntries(
      Object.entries(providerFields).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(pd).length > 0) {
      await tx.update(providerDetails)
        .set({ ...pd, updated_at: sql`NOW()` })
        .where(eq(providerDetails.user_id, userId));
    }
  });
}

// ─── Link verification ───────────────────────────────────────────────────────────

export async function verifyProviderLink(
  db: DbClient,
  providerId: string,
  patientId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: patientProviderLinks.id })
    .from(patientProviderLinks)
    .where(and(
      eq(patientProviderLinks.provider_id, providerId),
      eq(patientProviderLinks.patient_id, patientId),
      isNull(patientProviderLinks.unlinked_at),
    ))
    .limit(1);
  return !!row;
}

// ─── Patient dashboard ───────────────────────────────────────────────────────────

function buildPatientSearchFilter(providerId: string, search?: string) {
  return sql`
    ppl.provider_id = ${providerId}
    AND ppl.unlinked_at IS NULL
    ${search ? sql`AND (LOWER(p.first_name) LIKE ${`%${search.toLowerCase()}%`} OR LOWER(p.last_name) LIKE ${`%${search.toLowerCase()}%`})` : sql``}
  `;
}

type PatientListRow = {
  patient_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  linked_at: Date;
  last_symptom_at: string | null;
  avg_pain_7d: string | null;
  exercises_completed_7d: string | null;
};

export async function listLinkedPatients(
  db: DbClient,
  providerId: string,
  page: number,
  limit: number,
  search?: string,
) {
  const offset = (page - 1) * limit;

  // LEFT JOIN LATERAL replaces the three correlated sub-queries.
  // Each lateral is evaluated once per driving row rather than once per value
  // lookup, allowing the planner to use indexes and parallel plans effectively.
  const result = await db.execute<PatientListRow>(sql`
    SELECT
      ppl.patient_id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      ppl.linked_at,
      last_s.last_symptom_at,
      pain.avg_pain_7d,
      comp.exercises_completed_7d
    FROM patient_provider_links ppl
    JOIN profiles p ON p.user_id = ppl.patient_id
    LEFT JOIN LATERAL (
      SELECT MAX(sl.logged_at)::text AS last_symptom_at
      FROM symptom_logs sl
      WHERE sl.patient_id = ppl.patient_id
    ) last_s ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(sl.pain_level)::numeric, 1)::text AS avg_pain_7d
      FROM symptom_logs sl
      WHERE sl.patient_id = ppl.patient_id
        AND sl.logged_at >= NOW() - INTERVAL '7 days'
    ) pain ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::text AS exercises_completed_7d
      FROM exercise_completions ec
      JOIN exercise_assignments ea ON ea.id = ec.assignment_id
      WHERE ea.patient_id = ppl.patient_id
        AND ea.provider_id = ${providerId}
        AND ec.completed_at >= NOW() - INTERVAL '7 days'
    ) comp ON true
    WHERE ${buildPatientSearchFilter(providerId, search)}
    ORDER BY ppl.linked_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows: PatientListRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    patient_id: r.patient_id,
    first_name: r.first_name,
    last_name: r.last_name,
    avatar_url: r.avatar_url,
    linked_at: r.linked_at,
    last_symptom_at: r.last_symptom_at,
    avg_pain_7d: r.avg_pain_7d ? parseFloat(r.avg_pain_7d) : null,
    exercises_completed_7d: r.exercises_completed_7d ? parseInt(r.exercises_completed_7d, 10) : 0,
  }));
}

export async function countLinkedPatients(
  db: DbClient,
  providerId: string,
  search?: string,
) {
  type CountRow = { total: string };
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total
    FROM patient_provider_links ppl
    JOIN profiles p ON p.user_id = ppl.patient_id
    WHERE ${buildPatientSearchFilter(providerId, search)}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

// ─── Patient detail (provider view) ──────────────────────────────────────────────

export async function getPatientDetail(db: DbClient, patientId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      date_of_birth: profiles.date_of_birth,
      gender: profiles.gender,
      avatar_url: profiles.avatar_url,
      city: profiles.city,
      state: profiles.state,
      timezone: profiles.timezone,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.user_id))
    .where(and(eq(users.id, patientId), isNull(users.deleted_at)));
  return row ?? null;
}

// ─── Exercise library (provider-owned) ───────────────────────────────────────────

export async function listProviderExercises(
  db: DbClient,
  providerId: string,
  page: number,
  limit: number,
  category?: string,
) {
  const offset = (page - 1) * limit;
  const conditions = [eq(exercises.provider_id, providerId)];
  if (category) {
    conditions.push(eq(exercises.category, category));
  }

  return db
    .select()
    .from(exercises)
    .where(and(...conditions))
    .orderBy(desc(exercises.created_at))
    .limit(limit)
    .offset(offset);
}

export async function countProviderExercises(
  db: DbClient,
  providerId: string,
  category?: string,
) {
  type CountRow = { total: string };
  const conditions = category
    ? sql`provider_id = ${providerId} AND category = ${category}`
    : sql`provider_id = ${providerId}`;
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM exercises WHERE ${conditions}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function findExerciseById(db: DbClient, id: string, providerId: string) {
  const [row] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.provider_id, providerId)))
    .limit(1);
  return row ?? null;
}

export async function insertExercise(
  db: DbClient,
  providerId: string,
  data: {
    title: string;
    description?: string | null;
    duration_seconds?: number | null;
    category?: string | null;
    instructions?: string | null;
    video_url?: string | null;
    thumbnail_url?: string | null;
  },
) {
  const [row] = await db
    .insert(exercises)
    .values({ provider_id: providerId, ...data })
    .returning();
  return row;
}

export async function updateExercise(
  db: DbClient,
  id: string,
  providerId: string,
  data: Partial<typeof exercises.$inferInsert>,
) {
  const [row] = await db
    .update(exercises)
    .set({ ...data, updated_at: sql`NOW()` })
    .where(and(eq(exercises.id, id), eq(exercises.provider_id, providerId)))
    .returning();
  return row ?? null;
}

export async function deleteExercise(
  db: DbClient,
  id: string,
  providerId: string,
): Promise<boolean> {
  const result = await db
    .delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.provider_id, providerId)))
    .returning({ id: exercises.id });
  return result.length > 0;
}

// ─── Assignments (provider manages) ──────────────────────────────────────────────

export async function listPatientAssignments(
  db: DbClient,
  providerId: string,
  patientId: string,
) {
  return db
    .select({
      id: exerciseAssignments.id,
      exercise_id: exercises.id,
      title: exercises.title,
      description: exercises.description,
      video_url: exercises.video_url,
      thumbnail_url: exercises.thumbnail_url,
      frequency: exerciseAssignments.frequency,
      sets: exerciseAssignments.sets,
      status: exerciseAssignments.status,
      assigned_at: exerciseAssignments.assigned_at,
    })
    .from(exerciseAssignments)
    .innerJoin(exercises, eq(exerciseAssignments.exercise_id, exercises.id))
    .where(and(
      eq(exerciseAssignments.provider_id, providerId),
      eq(exerciseAssignments.patient_id, patientId),
    ))
    .orderBy(desc(exerciseAssignments.assigned_at));
}

export async function insertAssignment(
  db: DbClient,
  data: {
    exercise_id: string;
    patient_id: string;
    provider_id: string;
    frequency: string;
    sets: number;
  },
) {
  const [row] = await db
    .insert(exerciseAssignments)
    .values(data)
    .returning();
  return row;
}

export async function findAssignmentById(
  db: DbClient,
  id: string,
  providerId: string,
) {
  const [row] = await db
    .select()
    .from(exerciseAssignments)
    .where(and(eq(exerciseAssignments.id, id), eq(exerciseAssignments.provider_id, providerId)))
    .limit(1);
  return row ?? null;
}

export async function updateAssignment(
  db: DbClient,
  id: string,
  providerId: string,
  data: {
    frequency?: string;
    sets?: number;
    status?: 'active' | 'paused' | 'completed';
  },
) {
  const [row] = await db
    .update(exerciseAssignments)
    .set(data)
    .where(and(eq(exerciseAssignments.id, id), eq(exerciseAssignments.provider_id, providerId)))
    .returning();
  return row ?? null;
}

export async function deleteAssignment(
  db: DbClient,
  id: string,
  providerId: string,
): Promise<boolean> {
  const result = await db
    .delete(exerciseAssignments)
    .where(and(eq(exerciseAssignments.id, id), eq(exerciseAssignments.provider_id, providerId)))
    .returning({ id: exerciseAssignments.id });
  return result.length > 0;
}
