import { createDb, type Db } from './database';
import { createEmailService, type EmailService } from '../services/email';
import { createSmsService, type SmsService } from '../services/sms';
import { createPushService, type PushService } from '../services/push';
import { createStorageDriver, type StorageDriver } from '../services/storage';
import { createNotifyService, type NotifyService } from '../services/notify';
import { createLogger, type Logger } from './logger';
import { env, type Env } from './env';
import type { Pool } from 'pg';

/**
 * The DI container holds all application-level dependencies.
 * It is created once at startup and passed down to routes and jobs.
 *
 * RULES:
 * - This is the ONLY file that imports concrete service implementations.
 * - Route files, middleware, and jobs receive the container (or a subset) as an argument.
 * - In tests, create a test container with in-memory stubs — no mocking libraries needed.
 * - No runtime DI framework (tsyringe, inversify, etc.). This is a plain object.
 */
export async function createContainer() {
  const logger = createLogger(env.NODE_ENV, env.LOG_LEVEL);

  const { db, pool } = createDb(env.DATABASE_URL);

  const email = createEmailService(env, logger);
  const sms = createSmsService(env, logger);
  const push = createPushService(env, logger);
  const storage = await createStorageDriver(env, logger);
  const notify = createNotifyService({ email, sms, push, db, logger });

  return { db, pool, email, sms, push, storage, notify, logger, env };
}

export type Container = {
  db: Db['db'];
  pool: Pool;
  email: EmailService;
  sms: SmsService;
  push: PushService;
  storage: StorageDriver;
  notify: NotifyService;
  logger: Logger;
  env: Env;
};
