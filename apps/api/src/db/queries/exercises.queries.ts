/**
 * exercises.queries.ts — All database interactions for the exercises module.
 */
import { eq, and, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { exerciseAssignments, exerciseCompletions, exercises } from '../schema';

type DbClient = Db['db'];

export async function listActiveAssignments(db: DbClient, patientId: string) {
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
    })
    .from(exerciseAssignments)
    .innerJoin(exercises, eq(exerciseAssignments.exercise_id, exercises.id))
    .where(and(
      eq(exerciseAssignments.patient_id, patientId),
      eq(exerciseAssignments.status, 'active'),
    ))
    .orderBy(exerciseAssignments.assigned_at);
}

export async function findActiveAssignment(
  db: DbClient,
  assignmentId: string,
  patientId: string,
) {
  const [row] = await db
    .select({ id: exerciseAssignments.id })
    .from(exerciseAssignments)
    .where(and(
      eq(exerciseAssignments.id, assignmentId),
      eq(exerciseAssignments.patient_id, patientId),
      eq(exerciseAssignments.status, 'active'),
    ))
    .limit(1);
  return row ?? null;
}

export async function findTodayCompletion(
  db: DbClient,
  assignmentId: string,
  patientId: string,
) {
  const [row] = await db
    .select({ id: exerciseCompletions.id })
    .from(exerciseCompletions)
    .where(and(
      eq(exerciseCompletions.assignment_id, assignmentId),
      eq(exerciseCompletions.patient_id, patientId),
      sql`DATE(${exerciseCompletions.completed_at}) = CURRENT_DATE`,
    ))
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
