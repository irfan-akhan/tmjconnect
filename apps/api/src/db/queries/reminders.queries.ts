/**
 * reminders.queries.ts — All database interactions for the reminders module.
 */
import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reminders, profiles } from '../schema';

type DbClient = Db['db'];

export async function listReminders(db: DbClient, userId: string) {
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.user_id, userId))
    .orderBy(desc(reminders.created_at));
}

export async function findReminder(db: DbClient, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.user_id, userId)))
    .limit(1);
  return row ?? null;
}

export type ReminderInsertData = {
  user_id: string;
  type: 'exercise' | 'symptom';
  time: string;
  days: string[];
  enabled: boolean;
  next_fire_at: Date;
};

export async function insertReminder(db: DbClient, data: ReminderInsertData) {
  const [row] = await db
    .insert(reminders)
    .values(data)
    .returning();
  return row;
}

export async function updateReminder(
  db: DbClient,
  id: string,
  fields: Partial<typeof reminders.$inferInsert>,
) {
  const [row] = await db
    .update(reminders)
    .set(fields)
    .where(eq(reminders.id, id))
    .returning();
  return row ?? null;
}

export async function deleteReminder(db: DbClient, id: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.user_id, userId)))
    .returning({ id: reminders.id });
  return result.length > 0;
}

export async function getUserTimezone(db: DbClient, userId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .limit(1);
  return row?.timezone ?? 'America/Chicago';
}
