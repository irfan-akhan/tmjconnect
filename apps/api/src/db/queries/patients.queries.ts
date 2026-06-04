/**
 * Reusable patient queries used across patient routes.
 * All queries scope to a specific userId to prevent PHI leakage.
 */
import { eq, and, isNull, desc, gt } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import {
  users,
  profiles,
  sessions,
  refreshTokens,
  notificationPreferences,
} from '../schema';

// ─── Profile ───────────────────────────────────────────────────────────────────────

export async function getPatientWithProfile(db: Db['db'], userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
      is_active: users.is_active,
      email_verified: users.email_verified,
      mfa_enabled: users.mfa_enabled,
      fcm_token: users.fcm_token,
      tos_accepted_at: users.tos_accepted_at,
      tos_version: users.tos_version,
      created_at: users.created_at,
      updated_at: users.updated_at,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      date_of_birth: profiles.date_of_birth,
      gender: profiles.gender,
      avatar_url: profiles.avatar_url,
      city: profiles.city,
      state: profiles.state,
      timezone: profiles.timezone,
      profile_updated_at: profiles.updated_at,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.user_id))
    .where(and(eq(users.id, userId), isNull(users.deleted_at)));
  return row ?? null;
}

export async function updatePatientProfile(
  db: Db['db'],
  userId: string,
  profileFields: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string | null;
    gender?: string | null;
    city?: string | null;
    state?: string | null;
    timezone?: string;
    avatar_url?: string | null;
  },
) {
  const filteredFields = Object.fromEntries(
    Object.entries(profileFields).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(filteredFields).length === 0) return;

  await db
    .update(profiles)
    .set({ ...filteredFields, updated_at: sql`NOW()` })
    .where(eq(profiles.user_id, userId));
}

export async function softDeleteUser(db: Db['db'], userId: string) {
  await db
    .update(users)
    .set({ deleted_at: sql`NOW()`, updated_at: sql`NOW()` })
    .where(eq(users.id, userId));
}

export async function deleteAccountTransaction(db: Db['db'], userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.user_id, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
    await tx.update(users)
      .set({ deleted_at: sql`NOW()`, updated_at: sql`NOW()` })
      .where(eq(users.id, userId));
  });
}

// ─── Sessions ──────────────────────────────────────────────────────────────────────

export async function getActiveSessions(db: Db['db'], userId: string) {
  return db
    .select({
      id: sessions.id,
      user_id: sessions.user_id,
      device_info: sessions.device_info,
      ip_address: sessions.ip_address,
      last_active: sessions.last_active,
      expires_at: sessions.expires_at,
      created_at: sessions.created_at,
    })
    .from(sessions)
    .where(and(eq(sessions.user_id, userId), gt(sessions.expires_at, sql`NOW()`)))
    .orderBy(desc(sessions.last_active));
}

export async function deleteSessionById(
  db: Db['db'],
  sessionId: string,
  userId: string,
): Promise<boolean> {
  // Get the session's device_info before deleting, so we can also revoke
  // refresh tokens for that device (prevents the device from refreshing back in).
  const [session] = await db
    .select({ id: sessions.id, device_info: sessions.device_info })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
    .limit(1);

  if (!session) return false;

  await db.delete(sessions).where(eq(sessions.id, session.id));

  // Revoke all active refresh tokens for this user+device
  if (session.device_info) {
    await db
      .update(refreshTokens)
      .set({ revoked_at: sql`NOW()` })
      .where(
        and(
          eq(refreshTokens.user_id, userId),
          eq(refreshTokens.device_info, session.device_info),
          isNull(refreshTokens.revoked_at),
        ),
      );
  }

  return true;
}

// ─── Notification preferences ──────────────────────────────────────────────────────

export async function getNotificationPrefs(db: Db['db'], userId: string) {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.user_id, userId));
  return row ?? null;
}

export async function updateNotificationPrefs(
  db: Db['db'],
  userId: string,
  fields: {
    exercise_reminders?: boolean;
    symptom_checkin?: boolean;
    provider_messages?: boolean;
    report_updates?: boolean;
    tips_updates?: boolean;
    email_digest?: 'instant' | 'daily' | 'weekly' | 'off';
  },
) {
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(filtered).length === 0) return;

  await db
    .update(notificationPreferences)
    .set({ ...filtered, updated_at: sql`NOW()` })
    .where(eq(notificationPreferences.user_id, userId));
}
