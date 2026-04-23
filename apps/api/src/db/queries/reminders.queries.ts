/**
 * reminders.queries.ts — All database interactions for the reminders module.
 */
import { eq, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reminders, profiles } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];

export async function listReminders(db: DbClient, user: ScopedUser) {
  return db
    .select()
    .from(reminders)
    .where(scopeToUser(undefined, reminders, user))
    .orderBy(desc(reminders.created_at));
}

export async function findReminder(db: DbClient, id: string, user: ScopedUser) {
  const [row] = await db
    .select()
    .from(reminders)
    .where(scopeToUser(eq(reminders.id, id), reminders, user))
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

/**
 * updateReminder — Partial update. Ownership enforced at the DB level:
 * the UPDATE's WHERE clause includes scopeToUser, so an attempt to update
 * another user's reminder returns zero rows (and the caller treats it as
 * "not found"). Previously this relied on a findReminder check in the
 * use-case — now the guarantee is single-point.
 */
export async function updateReminder(
  db: DbClient,
  id: string,
  user: ScopedUser,
  fields: Partial<typeof reminders.$inferInsert>,
) {
  const [row] = await db
    .update(reminders)
    .set(fields)
    .where(scopeToUser(eq(reminders.id, id), reminders, user))
    .returning();
  return row ?? null;
}

export async function deleteReminder(db: DbClient, id: string, user: ScopedUser): Promise<boolean> {
  const result = await db
    .delete(reminders)
    .where(scopeToUser(eq(reminders.id, id), reminders, user))
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
