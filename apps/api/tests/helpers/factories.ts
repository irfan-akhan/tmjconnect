import { setupTestEnv } from './testEnv';
setupTestEnv();

import type { Db } from '../../src/config/database';
import { users, profiles, providerDetails, notificationPreferences, sessions } from '../../src/db/schema';
import { hashPassword } from '../../src/utils/hash';

/**
 * Inserts an active session row for a user. Required for any provider/admin
 * test that calls a route — checkSessionTimeout middleware deletes the session
 * and returns 401 if no row exists for req.user.id.
 */
export async function createTestSession(db: Db['db'], userId: string): Promise<void> {
  await db.insert(sessions).values({
    user_id: userId,
    device_info: 'test',
    last_active: new Date(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

type Db_type = Db['db'];

export interface TestUser {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'admin';
  password: string; // plaintext — for use in login requests
}

export interface TestProvider extends TestUser {
  role: 'provider';
}

/**
 * Creates a verified patient user in the test database.
 * Returns the user record plus the plaintext password for login tests.
 */
export async function createTestPatient(
  db: Db_type,
  overrides?: Partial<{
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    timezone: string;
    email_verified: boolean;
    is_active: boolean;
  }>,
): Promise<TestUser> {
  const password = overrides?.password ?? 'Test@1234!';
  const email = overrides?.email ?? `patient-${Date.now()}@test.com`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash: await hashPassword(password),
      role: 'patient',
      email_verified: overrides?.email_verified ?? true,
      is_active: overrides?.is_active ?? true,
    })
    .returning({ id: users.id });

  await db.insert(profiles).values({
    user_id: user.id,
    first_name: overrides?.first_name ?? 'Test',
    last_name: overrides?.last_name ?? 'Patient',
    timezone: overrides?.timezone ?? 'America/Chicago',
  });

  await db.insert(notificationPreferences).values({ user_id: user.id });

  return { id: user.id, email, role: 'patient', password };
}

/**
 * Creates a verified provider user with MFA enabled in the test database.
 */
export async function createTestProvider(
  db: Db_type,
  overrides?: Partial<{
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    mfa_enabled: boolean;
    email_verified: boolean;
  }>,
): Promise<TestProvider> {
  const password = overrides?.password ?? 'Test@1234!';
  const email = overrides?.email ?? `provider-${Date.now()}@test.com`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash: await hashPassword(password),
      role: 'provider',
      email_verified: overrides?.email_verified ?? true,
      is_active: true,
      mfa_enabled: overrides?.mfa_enabled ?? false,
    })
    .returning({ id: users.id });

  await db.insert(profiles).values({
    user_id: user.id,
    first_name: overrides?.first_name ?? 'Test',
    last_name: overrides?.last_name ?? 'Provider',
    timezone: 'America/Chicago',
  });

  await db.insert(providerDetails).values({
    user_id: user.id,
    license_number: 'TEST-001',
    license_type: 'DDS',
    specialty: 'Orofacial Pain',
    clinic_name: 'Test Clinic',
  });

  await db.insert(notificationPreferences).values({ user_id: user.id });

  // Provider routes use checkSessionTimeout — they require an active session row.
  await createTestSession(db, user.id);

  return { id: user.id, email, role: 'provider', password };
}

/**
 * Creates a verified admin user in the test database.
 */
export async function createTestAdmin(
  db: Db_type,
  overrides?: Partial<{ email: string; password: string }>,
): Promise<TestUser> {
  const password = overrides?.password ?? 'Admin@1234!';
  const email = overrides?.email ?? `admin-${Date.now()}@test.com`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash: await hashPassword(password),
      role: 'admin',
      email_verified: true,
      is_active: true,
      mfa_enabled: false,
    })
    .returning({ id: users.id });

  await db.insert(profiles).values({
    user_id: user.id,
    first_name: 'Test',
    last_name: 'Admin',
    timezone: 'America/Chicago',
  });

  await db.insert(notificationPreferences).values({ user_id: user.id });

  // Admin routes use checkSessionTimeout — they require an active session row.
  await createTestSession(db, user.id);

  return { id: user.id, email, role: 'admin', password };
}
