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
import { insertJobRun, completeJobRun } from '../db/queries/admin.queries';

/**
 * withAdvisoryLock — Wraps a job function with a PostgreSQL advisory lock.
 * The lock is session-level and released when the connection is returned to the pool.
 * If the lock is already held, the job silently skips this run.
 *
 * Every run is recorded in the `job_runs` table so the admin "Job runner
 * health" panel has full execution history, success rates, and durations.
 */
async function withAdvisoryLock(
  pool: Pool,
  lockId: number,
  jobName: string,
  logger: Container['logger'],
  db: Container['db'],
  fn: () => Promise<number | void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockId],
    );
    if (!rows[0]?.acquired) {
      logger.debug({ jobName, lockId }, 'Job skipped — advisory lock held by another instance');
      // Record the skip so the admin sees it.
      try {
        const runId = await insertJobRun(db, jobName);
        if (runId) await completeJobRun(db, runId, 'skipped', 0);
      } catch { /* best-effort */ }
      return;
    }

    const start = Date.now();
    let runId: string | null = null;
    try {
      runId = await insertJobRun(db, jobName);
    } catch { /* best-effort — don't block job if recording fails */ }

    try {
      const rowsAffected = await fn();
      const durationMs = Date.now() - start;
      if (runId) {
        try {
          await completeJobRun(db, runId, 'success', durationMs, typeof rowsAffected === 'number' ? rowsAffected : undefined);
        } catch { /* best-effort */ }
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      if (runId) {
        try {
          await completeJobRun(db, runId, 'failed', durationMs, undefined, (err as Error).message);
        } catch { /* best-effort */ }
      }
      throw err; // re-throw so the outer .catch logs it
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
    }
  } finally {
    client.release();
  }
}

export function registerJobs(container: Container) {
  const { pool, db, logger } = container;

  // Every minute — fire due reminders.
  cron.schedule('* * * * *', () => {
    withAdvisoryLock(pool, 1, 'reminderJob', logger, db, () => reminderJob(container))
      .catch((err) => logger.error({ err }, 'reminderJob failed'));
  });

  // Every hour — expire codes and idempotency keys.
  cron.schedule('0 * * * *', () => {
    withAdvisoryLock(pool, 2, 'codeExpiryJob', logger, db, () => codeExpiryJob(container))
      .catch((err) => logger.error({ err }, 'codeExpiryJob failed'));
  });

  // Every hour — fire weekly digests where next_digest_at <= NOW().
  cron.schedule('5 * * * *', () => {
    withAdvisoryLock(pool, 3, 'weeklyDigestJob', logger, db, () => weeklyDigestJob(container))
      .catch((err) => logger.error({ err }, 'weeklyDigestJob failed'));
  });

  // 3 AM daily — HIPAA-compliant account cleanup.
  cron.schedule('0 3 * * *', () => {
    withAdvisoryLock(pool, 4, 'cleanupJob', logger, db, () => cleanupJob(container))
      .catch((err) => logger.error({ err }, 'cleanupJob failed'));
  });

  // 4 AM daily — orphan file cleanup.
  cron.schedule('0 4 * * *', () => {
    withAdvisoryLock(pool, 5, 'orphanFileCleanupJob', logger, db, () => orphanFileCleanupJob(container))
      .catch((err) => logger.error({ err }, 'orphanFileCleanupJob failed'));
  });

  // Every minute — drain the notification outbox.
  cron.schedule('* * * * *', () => {
    withAdvisoryLock(pool, 6, 'outboxJob', logger, db, () => outboxJob(container))
      .catch((err) => logger.error({ err }, 'outboxJob failed'));
  });

  logger.info('Scheduled jobs registered (6 jobs)');
}
