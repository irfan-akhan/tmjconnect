/**
 * exercises.queries.ts — All database interactions for the exercises module.
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { exerciseAssignments, exerciseCompletions, exercises, profiles } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];

export async function listActiveAssignments(db: DbClient, user: ScopedUser) {
  return db
    .select({
      assignment_id: exerciseAssignments.id,
      exercise_id: exercises.id,
      title: exercises.title,
      description: exercises.description,
      duration_seconds: exercises.duration_seconds,
      category: exercises.category,
      instructions: exercises.instructions,
      video_url: exercises.video_url,
      thumbnail_url: exercises.thumbnail_url,
      frequency: exerciseAssignments.frequency,
      sets: exerciseAssignments.sets,
      status: exerciseAssignments.status,
      assigned_at: exerciseAssignments.assigned_at,
      // Provider attribution — so the patient knows who gave them this.
      // We always show the current name via the JOIN; if the link has since
      // been disconnected the historical attribution stays on the card.
      provider_id: exerciseAssignments.provider_id,
      provider_first_name: profiles.first_name,
      provider_last_name: profiles.last_name,
      // Did the patient already mark this assignment complete today? We use a
      // correlated EXISTS subquery — the completions table has a UNIQUE
      // constraint on (assignment_id, patient_id, DATE(completed_at)) so there
      // is at most one row per assignment per day.
      completed_today: sql<boolean>`EXISTS (
        SELECT 1 FROM ${exerciseCompletions}
        WHERE ${exerciseCompletions.assignment_id} = ${exerciseAssignments.id}
          AND DATE(${exerciseCompletions.completed_at}) = CURRENT_DATE
      )`,
    })
    .from(exerciseAssignments)
    .innerJoin(exercises, eq(exerciseAssignments.exercise_id, exercises.id))
    .innerJoin(profiles, eq(profiles.user_id, exerciseAssignments.provider_id))
    .where(scopeToUser(eq(exerciseAssignments.status, 'active'), exerciseAssignments, user))
    .orderBy(exerciseAssignments.assigned_at);
}

export async function findActiveAssignment(
  db: DbClient,
  assignmentId: string,
  user: ScopedUser,
) {
  const [row] = await db
    .select({ id: exerciseAssignments.id })
    .from(exerciseAssignments)
    .where(
      scopeToUser(
        and(eq(exerciseAssignments.id, assignmentId), eq(exerciseAssignments.status, 'active')),
        exerciseAssignments,
        user,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findTodayCompletion(
  db: DbClient,
  assignmentId: string,
  user: ScopedUser,
) {
  const [row] = await db
    .select({ id: exerciseCompletions.id })
    .from(exerciseCompletions)
    .where(
      scopeToUser(
        and(
          eq(exerciseCompletions.assignment_id, assignmentId),
          sql`DATE(${exerciseCompletions.completed_at}) = CURRENT_DATE`,
        ),
        exerciseCompletions,
        user,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getCompletionById(db: DbClient, id: string) {
  const [row] = await db
    .select()
    .from(exerciseCompletions)
    .where(eq(exerciseCompletions.id, id));
  return row ?? null;
}

export async function insertCompletion(
  db: DbClient,
  assignmentId: string,
  patientId: string,
) {
  const [row] = await db
    .insert(exerciseCompletions)
    .values({ assignment_id: assignmentId, patient_id: patientId })
    .returning();
  return row;
}
