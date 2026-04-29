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
      date_of_birth: profiles.date_of_birth,
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
  // JSON array of { date: 'YYYY-MM-DD', pain_level: number } for the last 14 days.
  daily_pain_14d: Array<{ date: string; pain_level: number }> | null;
};

export async function listLinkedPatients(
  db: DbClient,
  providerId: string,
  page: number,
  limit: number,
  search?: string,
) {
  const offset = (page - 1) * limit;

  // LEFT JOIN LATERAL replaces the correlated sub-queries.
  // Each lateral is evaluated once per driving row rather than once per value
  // lookup, allowing the planner to use indexes and parallel plans effectively.
  // daily_pain_14d aggregates one row per day (avg pain per day) for the last
  // 14 days — feeds the row sparkline on the dashboard / patients table.
  const result = await db.execute<PatientListRow>(sql`
    SELECT
      ppl.patient_id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      ppl.linked_at,
      last_s.last_symptom_at,
      pain.avg_pain_7d,
      comp.exercises_completed_7d,
      trend.daily_pain_14d
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
    LEFT JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d::date, 'pain_level', avg_pain) ORDER BY d), '[]'::jsonb) AS daily_pain_14d
      FROM (
        SELECT DATE(sl.logged_at) AS d, ROUND(AVG(sl.pain_level)::numeric, 1)::float AS avg_pain
        FROM symptom_logs sl
        WHERE sl.patient_id = ppl.patient_id
          AND sl.logged_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(sl.logged_at)
      ) sub
    ) trend ON true
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
    daily_pain_14d: Array.isArray(r.daily_pain_14d) ? r.daily_pain_14d : [],
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

export type PatientDetailRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  // From the active patient_provider_links row.
  linked_at: string | null;
  consent_scope: string | null;
  diagnosis: string | null;
  // Computed aggregates over the trailing 7-day window.
  adherence_pct: number | null;
  avg_pain_7d: number | null;
  // MAX over symptom_logs ∪ reports for this patient (any contribution counts).
  last_activity_at: string | null;
  // Latest report urgency in the last 14 days. NULL if no recent report.
  urgency: 'routine' | 'concerning' | 'urgent' | null;
};

type RawDetailRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  linked_at: string | null;
  consent_scope: string | null;
  diagnosis: string | null;
  adherence_pct: string | null;
  avg_pain_7d: string | null;
  last_activity_at: string | null;
  urgency: 'routine' | 'concerning' | 'urgent' | null;
};

export async function getPatientDetail(
  db: DbClient,
  providerId: string,
  patientId: string,
): Promise<PatientDetailRow | null> {
  // adherence_pct: completed/expected over the last 7 days.
  // expected = sum(sets * days_in_window) for assignments active in the window.
  // We use a coarse approximation: 7 * sum(sets) for active assignments — good
  // enough for the dashboard chip; precise frequency parsing happens in the
  // dedicated patient-analytics query when the provider opens Insights.
  const result = await db.execute<RawDetailRow>(sql`
    SELECT
      u.id,
      u.email,
      p.first_name,
      p.last_name,
      p.date_of_birth,
      p.gender,
      p.avatar_url,
      p.city,
      p.state,
      p.timezone,
      ppl.linked_at::text AS linked_at,
      ppl.consent_scope,
      ppl.diagnosis,
      adherence.adherence_pct,
      pain.avg_pain_7d,
      activity.last_activity_at,
      urg.urgency
    FROM users u
    INNER JOIN profiles p ON p.user_id = u.id
    LEFT JOIN patient_provider_links ppl
      ON ppl.patient_id = u.id
     AND ppl.provider_id = ${providerId}
     AND ppl.unlinked_at IS NULL
    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN COALESCE(SUM(ea.sets), 0) = 0 THEN NULL
          ELSE LEAST(
            100,
            ROUND(
              (
                SELECT COUNT(*) FROM exercise_completions ec2
                JOIN exercise_assignments ea2 ON ea2.id = ec2.assignment_id
                WHERE ea2.patient_id = u.id
                  AND ea2.provider_id = ${providerId}
                  AND ec2.completed_at >= NOW() - INTERVAL '7 days'
              )::numeric / NULLIF(SUM(ea.sets) * 7, 0) * 100
            )
          )
        END::int AS adherence_pct
      FROM exercise_assignments ea
      WHERE ea.patient_id = u.id
        AND ea.provider_id = ${providerId}
        AND ea.status = 'active'
    ) adherence ON true
    LEFT JOIN LATERAL (
      SELECT ROUND(AVG(sl.pain_level)::numeric, 1)::text AS avg_pain_7d
      FROM symptom_logs sl
      WHERE sl.patient_id = u.id
        AND sl.logged_at >= NOW() - INTERVAL '7 days'
    ) pain ON true
    LEFT JOIN LATERAL (
      SELECT GREATEST(
        COALESCE((SELECT MAX(sl.logged_at) FROM symptom_logs sl WHERE sl.patient_id = u.id), 'epoch'),
        COALESCE((SELECT MAX(r.submitted_at) FROM reports r WHERE r.patient_id = u.id), 'epoch')
      )::text AS last_activity_at
    ) activity ON true
    LEFT JOIN LATERAL (
      SELECT r.urgency
      FROM reports r
      WHERE r.patient_id = u.id
        AND r.provider_id = ${providerId}
        AND r.submitted_at >= NOW() - INTERVAL '14 days'
      ORDER BY r.submitted_at DESC
      LIMIT 1
    ) urg ON true
    WHERE u.id = ${patientId} AND u.deleted_at IS NULL
    LIMIT 1
  `);
  const rows: RawDetailRow[] = Array.isArray(result) ? result : result.rows ?? [];
  const r = rows[0];
  if (!r) return null;

  // The 'epoch' fallback in the last_activity_at lateral surfaces as a 1970
  // timestamp when the patient has no logs and no reports — flatten to null
  // so the UI shows the empty placeholder instead of "55 years ago".
  const lastActivityRaw = r.last_activity_at;
  const last_activity_at =
    lastActivityRaw && !lastActivityRaw.startsWith('1970-')
      ? lastActivityRaw
      : null;

  return {
    id: r.id,
    email: r.email,
    first_name: r.first_name,
    last_name: r.last_name,
    date_of_birth: r.date_of_birth,
    gender: r.gender,
    avatar_url: r.avatar_url,
    city: r.city,
    state: r.state,
    timezone: r.timezone,
    linked_at: r.linked_at,
    consent_scope: r.consent_scope,
    diagnosis: r.diagnosis,
    adherence_pct: r.adherence_pct == null ? null : parseInt(String(r.adherence_pct), 10),
    avg_pain_7d: r.avg_pain_7d ? parseFloat(r.avg_pain_7d) : null,
    last_activity_at,
    urgency: r.urgency,
  };
}

// updatePatientLinkMeta — Updates the working diagnosis on the active link.
// Returns false if no active link exists for this provider/patient pair.
export async function updatePatientLinkMeta(
  db: DbClient,
  providerId: string,
  patientId: string,
  fields: { diagnosis?: string | null },
): Promise<boolean> {
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(filtered).length === 0) return true;
  const result = await db
    .update(patientProviderLinks)
    .set(filtered)
    .where(and(
      eq(patientProviderLinks.provider_id, providerId),
      eq(patientProviderLinks.patient_id, patientId),
      isNull(patientProviderLinks.unlinked_at),
    ))
    .returning({ id: patientProviderLinks.id });
  return result.length > 0;
}

// ─── Exercise library (provider-owned) ───────────────────────────────────────────

export type ProviderExerciseRow = typeof exercises.$inferSelect & {
  assignment_count: number;
  active_assignment_count: number;
  completion_pct: number | null;
};

type RawExerciseListRow = typeof exercises.$inferSelect & {
  assignment_count: string | null;
  active_assignment_count: string | null;
  completion_pct: string | null;
};

export async function listProviderExercises(
  db: DbClient,
  providerId: string,
  page: number,
  limit: number,
  category?: string,
): Promise<ProviderExerciseRow[]> {
  const offset = (page - 1) * limit;
  // Each lateral runs once per exercise row; cheap thanks to the FK index on
  // exercise_assignments.exercise_id.
  // completion_pct is the share of patient-days expected by active assignments
  // that were actually completed in the last 14 days (clamped to 100).
  const result = await db.execute<RawExerciseListRow>(sql`
    SELECT
      e.*,
      counts.assignment_count,
      counts.active_assignment_count,
      comp.completion_pct
    FROM exercises e
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::text AS assignment_count,
        COUNT(*) FILTER (WHERE ea.status = 'active')::text AS active_assignment_count
      FROM exercise_assignments ea
      WHERE ea.exercise_id = e.id
    ) counts ON true
    LEFT JOIN LATERAL (
      SELECT
        CASE
          WHEN expected.expected_days IS NULL OR expected.expected_days = 0 THEN NULL
          ELSE LEAST(
            100,
            ROUND(
              completions.completed::numeric / expected.expected_days * 100
            )
          )
        END::text AS completion_pct
      FROM (
        SELECT COUNT(*) AS completed
        FROM exercise_completions ec
        JOIN exercise_assignments ea ON ea.id = ec.assignment_id
        WHERE ea.exercise_id = e.id
          AND ec.completed_at >= NOW() - INTERVAL '14 days'
      ) completions,
      (
        SELECT SUM(ea.sets) * 14 AS expected_days
        FROM exercise_assignments ea
        WHERE ea.exercise_id = e.id
          AND ea.status = 'active'
      ) expected
    ) comp ON true
    WHERE e.provider_id = ${providerId}
      ${category ? sql`AND e.category = ${category}` : sql``}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);
  const rows: RawExerciseListRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    ...r,
    assignment_count: r.assignment_count ? parseInt(r.assignment_count, 10) : 0,
    active_assignment_count: r.active_assignment_count
      ? parseInt(r.active_assignment_count, 10)
      : 0,
    completion_pct: r.completion_pct == null ? null : parseInt(r.completion_pct, 10),
  }));
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
