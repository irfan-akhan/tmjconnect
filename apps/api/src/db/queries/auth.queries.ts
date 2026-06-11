/**
 * auth.queries.ts — All database interactions for the auth module.
 * This layer only reads and writes data. No business logic, no AppErrors.
 */
import { eq, and, ne, sql, isNull, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import {
  users,
  profiles,
  providerDetails,
  notificationPreferences,
  refreshTokens,
  sessions,
  mfaBackupCodes,
  passwordResets,
  loginEvents,
} from '../schema';

type DbClient = Db['db'];

// ─── User lookups ──────────────────────────────────────────────────────────────

export async function findUserByEmail(db: DbClient, email: string) {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function findUserForLogin(db: DbClient, email: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      password_hash: users.password_hash,
      email_verified: users.email_verified,
      is_active: users.is_active,
      mfa_enabled: users.mfa_enabled,
      deleted_at: users.deleted_at,
    })
    .from(users)
    .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function restoreSoftDeletedUser(db: DbClient, userId: string) {
  const [row] = await db
    .update(users)
    .set({ deleted_at: null, updated_at: sql`NOW()` })
    .where(eq(users.id, userId))
    .returning({ id: users.id, deleted_at: users.deleted_at });
  return row ?? null;
}

export async function findUserCoreById(db: DbClient, id: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findUserPasswordHash(db: DbClient, id: string) {
  const [row] = await db
    .select({ id: users.id, password_hash: users.password_hash })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findUserForMfaVerify(db: DbClient, id: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      mfa_secret: users.mfa_secret,
      sms_mfa_code_hash: users.sms_mfa_code_hash,
      sms_mfa_expires_at: users.sms_mfa_expires_at,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findUserForMfaSetup(db: DbClient, id: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email, mfa_enabled: users.mfa_enabled, mfa_secret: users.mfa_secret })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findUserForSms(db: DbClient, id: string) {
  const [row] = await db
    .select({ id: users.id, phone: users.phone, mfa_secret: users.mfa_secret })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function setSmsMfaCode(db: DbClient, userId: string, codeHash: string, expiresAt: Date) {
  await db
    .update(users)
    .set({ sms_mfa_code_hash: codeHash, sms_mfa_expires_at: expiresAt, updated_at: sql`NOW()` })
    .where(eq(users.id, userId));
}

export async function clearSmsMfaCode(db: DbClient, userId: string) {
  await db
    .update(users)
    .set({ sms_mfa_code_hash: null, sms_mfa_expires_at: null, updated_at: sql`NOW()` })
    .where(eq(users.id, userId));
}

export async function findUserByEmailActive(db: DbClient, email: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(
      eq(sql`LOWER(${users.email})`, email.toLowerCase()),
      isNull(users.deleted_at),
    ))
    .limit(1);
  return row ?? null;
}

export async function getProfileFirstName(db: DbClient, userId: string) {
  const [row] = await db
    .select({ first_name: profiles.first_name })
    .from(profiles)
    .where(eq(profiles.user_id, userId))
    .limit(1);
  return row?.first_name ?? null;
}

export async function getUserEmailProfile(db: DbClient, userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.user_id, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

// ─── Registration ──────────────────────────────────────────────────────────────

export type RegisterData = {
  email: string;
  password_hash: string;
  role: 'patient' | 'provider' | 'admin';
  email_verify_code: string;
  email_verify_expires: Date;
  first_name: string;
  last_name: string;
  phone: string;
  country: 'US' | 'CA' | 'IN';
  timezone: string;
  date_of_birth?: string;
  license_number?: string;
  license_type?: string;
  specialty?: string;
  clinic_name?: string;
  credentials?: string[] | null;
};

export async function createUserTransaction(db: DbClient, data: RegisterData): Promise<string> {
  return db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({
        email: data.email,
        password_hash: data.password_hash,
        role: data.role,
        phone: data.phone,
        email_verified: false,
        email_verify_code: data.email_verify_code,
        email_verify_expires: data.email_verify_expires,
      })
      .returning({ id: users.id });

    await tx.insert(profiles).values({
      user_id: newUser.id,
      first_name: data.first_name,
      last_name: data.last_name,
      country: data.country,
      date_of_birth: data.date_of_birth ?? null,
      timezone: data.timezone,
    });

    if (data.role === 'provider') {
      await tx.insert(providerDetails).values({
        user_id: newUser.id,
        license_number: data.license_number!,
        license_type: data.license_type!,
        specialty: data.specialty!,
        clinic_name: data.clinic_name!,
        credentials: data.credentials ?? null,
      });
    }

    await tx.insert(notificationPreferences).values({ user_id: newUser.id });
    return newUser.id;
  });
}

// ─── Email verification ────────────────────────────────────────────────────────

export async function findUnverifiedUser(db: DbClient, email: string) {
  const [row] = await db
    .select({
      id: users.id,
      role: users.role,
      email_verify_code: users.email_verify_code,
      email_verify_expires: users.email_verify_expires,
    })
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), eq(users.email_verified, false)))
    .limit(1);
  return row ?? null;
}

export async function setEmailVerified(db: DbClient, userId: string) {
  await db
    .update(users)
    .set({ email_verified: true, email_verify_code: null, email_verify_expires: null })
    .where(eq(users.id, userId));
}

export async function invalidateVerifyCode(db: DbClient, userId: string) {
  await db
    .update(users)
    .set({ email_verify_code: null, email_verify_expires: null })
    .where(eq(users.id, userId));
}

export async function findUnverifiedUserForResend(db: DbClient, email: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      email_verify_expires: users.email_verify_expires,
      updated_at: users.updated_at,
    })
    .from(users)
    .where(and(
      eq(sql`LOWER(${users.email})`, email.toLowerCase()),
      eq(users.email_verified, false),
    ))
    .limit(1);
  return row ?? null;
}

export async function updateVerifyCode(db: DbClient, userId: string, code: string, expires: Date) {
  await db
    .update(users)
    .set({ email_verify_code: code, email_verify_expires: expires })
    .where(eq(users.id, userId));
}

// ─── MFA ───────────────────────────────────────────────────────────────────────

export async function storeMfaSecret(db: DbClient, userId: string, encryptedSecret: string) {
  await db.update(users).set({ mfa_secret: encryptedSecret }).where(eq(users.id, userId));
}

export async function enableMfaTransaction(db: DbClient, userId: string, hashedCodes: string[]) {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ mfa_enabled: true }).where(eq(users.id, userId));
    await tx.insert(mfaBackupCodes).values(
      hashedCodes.map((hash) => ({ user_id: userId, code_hash: hash })),
    );
  });
}

export async function findUnusedBackupCodes(db: DbClient, userId: string) {
  return db
    .select({ id: mfaBackupCodes.id, code_hash: mfaBackupCodes.code_hash })
    .from(mfaBackupCodes)
    .where(and(eq(mfaBackupCodes.user_id, userId), eq(mfaBackupCodes.used, false)));
}

export async function markBackupCodeUsed(db: DbClient, codeId: string) {
  await db
    .update(mfaBackupCodes)
    .set({ used: true, used_at: new Date() })
    .where(eq(mfaBackupCodes.id, codeId));
}

// ─── Login events ──────────────────────────────────────────────────────────────

export type LoginEventData = {
  user_id: string;
  email: string;
  success: boolean;
  ip_address: string | null;
  device_info: string;
  failure_reason?: string;
};

export async function insertLoginEvent(db: DbClient, data: LoginEventData) {
  await db.insert(loginEvents).values(data);
}

export async function findSessionsByDeviceInfo(db: DbClient, userId: string, deviceInfo: string) {
  return db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.user_id, userId), eq(sessions.device_info, deviceInfo)))
    .limit(2);
}

// ─── Token pair ────────────────────────────────────────────────────────────────

export async function insertTokenPair(
  db: DbClient,
  userId: string,
  tokenHash: string,
  tokenFamily: string,
  deviceInfo: string,
  ip: string | null,
  refreshExpiresAt: Date,
) {
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.insert(refreshTokens).values({
      user_id: userId,
      token_hash: tokenHash,
      token_family: tokenFamily,
      device_info: deviceInfo,
      ip_address: ip,
      expires_at: refreshExpiresAt,
    });

    // Upsert session: reuse existing session for same user+device, or create new.
    const existingSession = await tx
      .update(sessions)
      .set({ last_active: sql`NOW()`, ip_address: ip, expires_at: sessionExpiresAt })
      .where(and(eq(sessions.user_id, userId), eq(sessions.device_info, deviceInfo)))
      .returning({ id: sessions.id });

    if (existingSession.length === 0) {
      await tx.insert(sessions).values({
        user_id: userId,
        device_info: deviceInfo,
        ip_address: ip,
        expires_at: sessionExpiresAt,
      });
    }
  });
}

/**
 * rotateRefreshTokenTransaction — Atomically marks the consumed token revoked,
 * inserts the new refresh token + session, all in one transaction.
 *
 * The old token is NOT deleted — it stays in the table with `revoked_at` set
 * so a subsequent replay of the rotated token can be detected (see the
 * "burn the family" flow in src/db/schema/auth.ts).
 *
 * The conditional WHERE on `revoked_at IS NULL` is the TOCTOU guard: two
 * concurrent rotations of the same token cannot both succeed — the second
 * UPDATE finds zero rows and the use-case treats it as a replay.
 */
export async function rotateRefreshTokenTransaction(
  db: DbClient,
  oldTokenId: string,
  userId: string,
  newTokenHash: string,
  tokenFamily: string,
  deviceInfo: string,
  ip: string | null,
  refreshExpiresAt: Date,
): Promise<{ rotated: boolean }> {
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(refreshTokens)
      .set({ revoked_at: sql`NOW()` })
      .where(and(eq(refreshTokens.id, oldTokenId), isNull(refreshTokens.revoked_at)))
      .returning({ id: refreshTokens.id });

    if (updated.length === 0) {
      // Lost the race — another request already rotated this token. Treat as replay.
      return { rotated: false };
    }

    await tx.insert(refreshTokens).values({
      user_id: userId,
      token_hash: newTokenHash,
      token_family: tokenFamily,
      device_info: deviceInfo,
      ip_address: ip,
      expires_at: refreshExpiresAt,
    });

    // Upsert session: update existing session for this user+device, or create one.
    const existingSession = await tx
      .update(sessions)
      .set({ last_active: sql`NOW()`, ip_address: ip, expires_at: sessionExpiresAt })
      .where(and(eq(sessions.user_id, userId), eq(sessions.device_info, deviceInfo)))
      .returning({ id: sessions.id });

    if (existingSession.length === 0) {
      await tx.insert(sessions).values({
        user_id: userId,
        device_info: deviceInfo,
        ip_address: ip,
        expires_at: sessionExpiresAt,
      });
    }

    return { rotated: true };
  });
}

/**
 * revokeRefreshTokenFamily — Burns every token in a family by setting
 * revoked_at = NOW() on every row that shares the family ID. Called when a
 * replay (use of a previously-rotated token) is detected, or when a logout-all
 * is invoked. Returns the count of tokens revoked for audit purposes.
 */
export async function revokeRefreshTokenFamily(
  db: DbClient,
  tokenFamily: string,
): Promise<number> {
  const result = await db
    .update(refreshTokens)
    .set({ revoked_at: sql`NOW()` })
    .where(and(eq(refreshTokens.token_family, tokenFamily), isNull(refreshTokens.revoked_at)))
    .returning({ id: refreshTokens.id });
  return result.length;
}

// ─── Refresh tokens ────────────────────────────────────────────────────────────

export async function findRefreshTokenByHash(db: DbClient, tokenHash: string) {
  const [row] = await db
    .select({
      id: refreshTokens.id,
      user_id: refreshTokens.user_id,
      token_family: refreshTokens.token_family,
      expires_at: refreshTokens.expires_at,
      revoked_at: refreshTokens.revoked_at,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.token_hash, tokenHash))
    .limit(1);
  return row ?? null;
}

/**
 * revokeRefreshTokenByHash — Soft-revokes a single refresh token (used by
 * logout). The row stays so a subsequent replay attempt is still detected as
 * "revoked", not "unknown". Pruned by codeExpiryJob after expires_at passes.
 * Also deletes the matching session so it no longer appears in "active sessions".
 */
export async function revokeRefreshTokenAndDeleteSession(db: DbClient, tokenHash: string): Promise<void> {
  const [revoked] = await db
    .update(refreshTokens)
    .set({ revoked_at: sql`NOW()` })
    .where(and(eq(refreshTokens.token_hash, tokenHash), isNull(refreshTokens.revoked_at)))
    .returning({ user_id: refreshTokens.user_id, device_info: refreshTokens.device_info });

  if (revoked?.user_id && revoked?.device_info) {
    await db
      .delete(sessions)
      .where(and(eq(sessions.user_id, revoked.user_id), eq(sessions.device_info, revoked.device_info)));
  }
}

export async function deleteAllTokensAndSessions(db: DbClient, userId: string, exceptDeviceInfo?: string) {
  await db.transaction(async (tx) => {
    if (exceptDeviceInfo) {
      // Revoke (not delete) tokens for other devices so replay detection still works
      await tx
        .update(refreshTokens)
        .set({ revoked_at: sql`NOW()` })
        .where(
          and(
            eq(refreshTokens.user_id, userId),
            ne(refreshTokens.device_info, exceptDeviceInfo),
            isNull(refreshTokens.revoked_at),
          ),
        );
      // Delete sessions for other devices only
      await tx
        .delete(sessions)
        .where(and(eq(sessions.user_id, userId), ne(sessions.device_info, exceptDeviceInfo)));
    } else {
      await tx.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
      await tx.delete(sessions).where(eq(sessions.user_id, userId));
    }
  });
}

// ─── Password reset ────────────────────────────────────────────────────────────

/**
 * upsertPasswordResetTransaction — Atomically deletes any existing unused reset
 * tokens for the user then inserts the new one. Prevents a user from holding
 * two valid reset tokens simultaneously by requesting the flow twice in a row.
 */
export async function upsertPasswordResetTransaction(
  db: DbClient,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  await db.transaction(async (tx) => {
    await tx.delete(passwordResets)
      .where(and(eq(passwordResets.user_id, userId), eq(passwordResets.used, false)));
    await tx.insert(passwordResets).values({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
  });
}

export async function findPasswordResetByHash(db: DbClient, tokenHash: string) {
  const [row] = await db
    .select({
      id: passwordResets.id,
      user_id: passwordResets.user_id,
      used: passwordResets.used,
      expires_at: passwordResets.expires_at,
    })
    .from(passwordResets)
    .where(eq(passwordResets.token_hash, tokenHash))
    .limit(1);
  return row ?? null;
}

export async function findLatestActivePasswordResetByUserId(db: DbClient, userId: string) {
  const [row] = await db
    .select({
      id: passwordResets.id,
      user_id: passwordResets.user_id,
      token_hash: passwordResets.token_hash,
      used: passwordResets.used,
      expires_at: passwordResets.expires_at,
    })
    .from(passwordResets)
    .where(and(eq(passwordResets.user_id, userId), eq(passwordResets.used, false)))
    .orderBy(desc(passwordResets.created_at))
    .limit(1);
  return row ?? null;
}

export async function rotatePasswordResetToSessionToken(
  db: DbClient,
  resetId: string,
  tokenHash: string,
  expiresAt: Date,
) {
  await db
    .update(passwordResets)
    .set({ token_hash: tokenHash, expires_at: expiresAt })
    .where(and(eq(passwordResets.id, resetId), eq(passwordResets.used, false)));
}

export async function consumePasswordResetTransaction(
  db: DbClient,
  resetId: string,
  userId: string,
  newPasswordHash: string,
) {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ password_hash: newPasswordHash }).where(eq(users.id, userId));
    await tx.update(passwordResets).set({ used: true }).where(eq(passwordResets.id, resetId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.user_id, userId));
    await tx.delete(sessions).where(eq(sessions.user_id, userId));
  });
}

// ─── User updates ──────────────────────────────────────────────────────────────

export async function updateUserPassword(db: DbClient, userId: string, passwordHash: string) {
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, userId));
}

export async function updateUserFcmToken(db: DbClient, userId: string, fcmToken: string) {
  await db.update(users).set({ fcm_token: fcmToken }).where(eq(users.id, userId));
}
