import { setupTestEnv } from './testEnv';
setupTestEnv();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../src/db/schema';
import type { Container } from '../../src/config/container';
import type { EmailService } from '../../src/services/email';
import type { SmsService } from '../../src/services/sms';
import type { PushService } from '../../src/services/push';
import type { StorageDriver } from '../../src/services/storage';
import type { NotifyService } from '../../src/services/notify';
import pino from 'pino';
import { env } from '../../src/config/env';

// ─── Test database ────────────────────────────────────────────────────────────────
const testPool = new Pool({ connectionString: env.DATABASE_URL });
const testDb = drizzle(testPool, { schema });

// ─── Stub services ────────────────────────────────────────────────────────────────
// All stubs are plain objects that implement the service interfaces.
// They record calls so tests can assert on them.
// No real email/SMS/push is sent during tests.

export const sentEmails: { to: string; type: string; args: unknown[] }[] = [];
export const sentSms: { to: string; body: string }[] = [];
export const sentPush: { token: string; title: string; body: string }[] = [];
export const createdNotifications: unknown[] = [];

function createStubEmail(): EmailService {
  const record = (type: string) => (to: string, ...args: unknown[]) => {
    sentEmails.push({ to, type, args });
    return Promise.resolve();
  };
  return {
    sendVerifyEmail: record('verifyEmail'),
    sendWelcome: record('welcome'),
    sendPasswordReset: record('passwordReset'),
    sendNewDeviceLogin: record('newDeviceLogin'),
    sendAccountLocked: record('accountLocked'),
    sendLinkAccepted: record('linkAccepted'),
    sendReportSubmitted: record('reportSubmitted'),
    sendReportReviewed: record('reportReviewed'),
    sendWeeklyDigest: record('weeklyDigest'),
    sendEmailInvite: record('emailInvite'),
  } as EmailService;
}

function createStubSms(): SmsService {
  return {
    sendMfaCode: (to, code) => {
      sentSms.push({ to, body: code });
      return Promise.resolve();
    },
    sendUrgentAlert: (to, message) => {
      sentSms.push({ to, body: message });
      return Promise.resolve();
    },
  };
}

function createStubPush(): PushService {
  return {
    sendPush: (token, title, body) => {
      sentPush.push({ token, title, body });
      return Promise.resolve();
    },
  };
}

function createStubStorage(): StorageDriver {
  const files = new Map<string, Buffer>();
  return {
    async upload(file, folder) {
      const key = `${folder}/test-${Date.now()}.bin`;
      files.set(key, file.buffer);
      return { key, url: `http://localhost:3001/uploads/${key}` };
    },
    getUrl(key) {
      return `http://localhost:3001/uploads/${key}`;
    },
    async delete(key) {
      files.delete(key);
    },
    async listKeys(folder) {
      return [...files.keys()].filter((k) => k.startsWith(folder));
    },
  };
}

function createStubNotify(db: Container['db']): NotifyService {
  const { notifications } = schema;
  return {
    async notify({ userId, type, title, body, data = {} }) {
      createdNotifications.push({ userId, type, title, body, data });
      await db.insert(notifications).values({ user_id: userId, type, title, body, data });
    },
  };
}

// ─── Test container factory ────────────────────────────────────────────────────────

/**
 * Creates a test container with real DB (test database) and stub external services.
 * Pass overrides to replace specific services for targeted tests.
 */
export function createTestContainer(overrides?: Partial<Container>): Container {
  const logger = pino({ level: 'silent' });
  const email = createStubEmail();
  const sms = createStubSms();
  const push = createStubPush();
  const storage = createStubStorage();
  const notify = createStubNotify(testDb);

  return {
    db: testDb,
    pool: testPool,
    email,
    sms,
    push,
    storage,
    notify,
    logger,
    env,
    ...overrides,
  };
}

/** Truncates all tables between tests for a clean slate. Retries on lock conflicts. */
export async function truncateAllTables(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await testPool.query(`
        TRUNCATE TABLE
          users, profiles, provider_details,
          refresh_tokens, sessions, mfa_backup_codes, password_resets,
          linking_codes, patient_provider_links,
          exercises, exercise_assignments, exercise_completions,
          symptom_logs, reports, report_responses,
          notifications, notification_preferences, notification_outbox, reminders,
          audit_logs, login_events, idempotency_keys,
          jaw_mobility_logs, medication_logs, sleep_logs
        RESTART IDENTITY CASCADE
      `);

      // Clear rate limiter tables (rate-limiter-flexible).
      // DELETE not TRUNCATE — avoids ACCESS EXCLUSIVE locks.
      await testPool.query(`
        DO $$
        DECLARE r record;
        BEGIN
          FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'rl_%'
          LOOP
            EXECUTE 'DELETE FROM ' || quote_ident(r.tablename);
          END LOOP;
        END $$;
      `);
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // 40P01 = deadlock_detected, 55P03 = lock_not_available
      if ((code === '40P01' || code === '55P03') && attempt < 2) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }
      throw err;
    }
  }
}

/** Closes the test pool. Call in afterAll(). */
export async function closeTestPool(): Promise<void> {
  await testPool.end();
}

/** Clears stub call records between tests. */
export function clearStubs(): void {
  sentEmails.length = 0;
  sentSms.length = 0;
  sentPush.length = 0;
  createdNotifications.length = 0;
}
