/**
 * notification-preferences.queries.ts — DB I/O for the per-user notification
 * preferences row. Separate from notifications.queries.ts which handles the
 * notification + outbox tables.
 *
 * The preferences row is created lazily on first read with all fields at
 * their schema defaults.
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { notificationPreferences } from '../schema';

type DbClient = Db['db'];

export type DigestFrequency = 'instant' | 'daily' | 'weekly' | 'off';

export type NotificationPreferences = {
  user_id: string;
  exercise_reminders: boolean;
  symptom_checkin: boolean;
  provider_messages: boolean;
  report_updates: boolean;
  tips_updates: boolean;
  email_digest: DigestFrequency;
  next_digest_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function getOrCreatePreferences(
  db: DbClient,
  userId: string,
): Promise<NotificationPreferences> {
  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.user_id, userId))
    .limit(1);
  if (existing) {
    return {
      user_id: existing.user_id,
      exercise_reminders: existing.exercise_reminders,
      symptom_checkin: existing.symptom_checkin,
      provider_messages: existing.provider_messages,
      report_updates: existing.report_updates,
      tips_updates: existing.tips_updates,
      email_digest: existing.email_digest as DigestFrequency,
      next_digest_at: existing.next_digest_at,
      created_at: existing.created_at,
      updated_at: existing.updated_at,
    };
  }
  const [inserted] = await db
    .insert(notificationPreferences)
    .values({ user_id: userId })
    .returning();
  return {
    user_id: inserted.user_id,
    exercise_reminders: inserted.exercise_reminders,
    symptom_checkin: inserted.symptom_checkin,
    provider_messages: inserted.provider_messages,
    report_updates: inserted.report_updates,
    tips_updates: inserted.tips_updates,
    email_digest: inserted.email_digest as DigestFrequency,
    next_digest_at: inserted.next_digest_at,
    created_at: inserted.created_at,
    updated_at: inserted.updated_at,
  };
}

export async function updatePreferences(
  db: DbClient,
  userId: string,
  fields: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  await getOrCreatePreferences(db, userId);
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(filtered).length === 0) {
    return getOrCreatePreferences(db, userId);
  }
  const [updated] = await db
    .update(notificationPreferences)
    .set(filtered)
    .where(eq(notificationPreferences.user_id, userId))
    .returning();
  return {
    user_id: updated.user_id,
    exercise_reminders: updated.exercise_reminders,
    symptom_checkin: updated.symptom_checkin,
    provider_messages: updated.provider_messages,
    report_updates: updated.report_updates,
    tips_updates: updated.tips_updates,
    email_digest: updated.email_digest as DigestFrequency,
    next_digest_at: updated.next_digest_at,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}
