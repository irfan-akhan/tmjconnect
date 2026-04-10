/**
 * Scheduled jobs registry.
 *
 * Each job acquires a PostgreSQL advisory lock before running to prevent
 * concurrent execution across multiple API instances. If the lock is held
 * (another instance is already running the job), the attempt is silently skipped.
 */
import cron from 'node-cron';
import type { Container } from '../config/container';
import type { Pool } from 'pg';
import { reminderJob } from './reminderJob';
import { codeExpiryJob } from './codeExpiryJob';
import { weeklyDigestJob } from './weeklyDigestJob';
import { cleanupJob } from './cleanupJob';
import { orphanFileCleanupJob } from './orphanFileCleanupJob';
import { outboxJob } from './outboxJob';

/**
 * withAdvisoryLock — Wraps a job function with a PostgreSQL advisory lock.
 * The lock is session-level and released when the connection is returned to the pool.
 * If the lock is already held, the job silently skips this run.
 */
async function withAdvisoryLock(
  pool: Pool,
  lockId: number,
  jobName: string,
  logger: Container['logger'],
  fn: () => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockId],
    );
    if (!rows[0]?.acquired) {
      logger.debug({ jobName, lockId }, 'Job skipped — advisory lock held by another instance');
      return;
    }

    try {
      await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  } finally {
    client.release();
  }
}

export function registerJobs(container: Container) {
  const { pool, logger } = container;

  // Every minute — fire due reminders.
  cron.schedule('* * * * *', () => {
    withAdvisoryLock(pool, 1, 'reminderJob', logger, () => reminderJob(container))
      .catch((err) => logger.error({ err }, 'reminderJob failed'));
  });

  // Every hour — expire codes and idempotency keys.
  cron.schedule('0 * * * *', () => {
    withAdvisoryLock(pool, 2, 'codeExpiryJob', logger, () => codeExpiryJob(container))
      .catch((err) => logger.error({ err }, 'codeExpiryJob failed'));
  });

  // Every hour — fire weekly digests where next_digest_at <= NOW().
  cron.schedule('5 * * * *', () => {
    withAdvisoryLock(pool, 3, 'weeklyDigestJob', logger, () => weeklyDigestJob(container))
      .catch((err) => logger.error({ err }, 'weeklyDigestJob failed'));
  });

  // 3 AM daily — HIPAA-compliant account cleanup.
  cron.schedule('0 3 * * *', () => {
    withAdvisoryLock(pool, 4, 'cleanupJob', logger, () => cleanupJob(container))
      .catch((err) => logger.error({ err }, 'cleanupJob failed'));
  });

  // 4 AM daily — orphan file cleanup.
  cron.schedule('0 4 * * *', () => {
    withAdvisoryLock(pool, 5, 'orphanFileCleanupJob', logger, () => orphanFileCleanupJob(container))
      .catch((err) => logger.error({ err }, 'orphanFileCleanupJob failed'));
  });

  // Every minute — drain the notification outbox.
  cron.schedule('* * * * *', () => {
    withAdvisoryLock(pool, 6, 'outboxJob', logger, () => outboxJob(container))
      .catch((err) => logger.error({ err }, 'outboxJob failed'));
  });

  logger.info('Scheduled jobs registered (6 jobs)');
}
