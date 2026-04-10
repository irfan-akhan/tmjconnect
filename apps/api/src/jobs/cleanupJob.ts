/**
 * cleanupJob — Runs at 3 AM daily.
 *
 * HIPAA-compliant hard-deletion of soft-deleted accounts (deleted_at > 30 days ago).
 *
 * Safety guard: if more than CLEANUP_MAX_BATCH_SIZE (50) accounts match, abort
 * and log a critical alert. This prevents runaway deletion from a bug or data issue.
 *
 * Per-user transaction:
 *   1. Blank PHI in profiles (first_name, last_name, dob, gender, city, state, avatar_url)
 *   2. SET NULL provider_id on reports (preserves patient report history)
 *   3. Delete sessions and refresh_tokens
 *   4. Hard-delete the user row (cascades to most child tables)
 *
 * NEVER touches audit_logs — they use ON DELETE SET NULL and have 6-year retention.
 */
import type { Container } from '../config/container';
import { sql, eq, and, isNotNull, lt } from 'drizzle-orm';
import { users, profiles, sessions, refreshTokens, reports } from '../db/schema';
import { CLEANUP_MAX_BATCH_SIZE } from '../config/constants';

export async function cleanupJob(container: Container) {
  const { db, logger } = container;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find soft-deleted users older than 30 days.
  const candidates = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(
      isNotNull(users.deleted_at),
      lt(users.deleted_at, cutoff),
    ));

  if (candidates.length === 0) return;

  // Safety guard.
  if (candidates.length > CLEANUP_MAX_BATCH_SIZE) {
    logger.error(
      { count: candidates.length, max: CLEANUP_MAX_BATCH_SIZE },
      'cleanupJob: ABORTED — candidate count exceeds safety limit. Investigate immediately.',
    );
    return;
  }

  logger.info({ count: candidates.length }, 'cleanupJob: starting hard-delete');

  let deleted = 0;
  for (const user of candidates) {
    try {
      await db.transaction(async (tx) => {
        // 1. Blank PHI in profile.
        await tx
          .update(profiles)
          .set({
            first_name: '[deleted]',
            last_name: '[deleted]',
            date_of_birth: null,
            gender: null,
            city: null,
            state: null,
            avatar_url: null,
            updated_at: sql`NOW()`,
          })
          .where(eq(profiles.user_id, user.id));

        // 2. Preserve report history — SET NULL on provider_id.
        await tx
          .update(reports)
          .set({ provider_id: null })
          .where(eq(reports.provider_id, user.id));

        // 3. Clean up sessions and tokens.
        await tx.delete(sessions).where(eq(sessions.user_id, user.id));
        await tx.delete(refreshTokens).where(eq(refreshTokens.user_id, user.id));

        // 4. Hard-delete user (cascades to most child tables).
        await tx.delete(users).where(eq(users.id, user.id));
      });

      deleted++;
    } catch (err) {
      logger.error({ err, userId: user.id }, 'cleanupJob: failed to delete user');
    }
  }

  logger.info({ deleted, total: candidates.length }, 'cleanupJob: complete');
}
