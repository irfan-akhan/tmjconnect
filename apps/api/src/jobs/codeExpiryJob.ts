/**
 * codeExpiryJob — Runs hourly.
 *
 * 1. Expire pending linking codes where expires_at < NOW()
 * 2. Delete idempotency keys where expires_at < NOW()
 * 3. Prune revoked refresh tokens past their expiry — they were kept around so
 *    that a replay would still hit a row, but once expired their job is done.
 */
import type { Container } from '../config/container';
import { sql, and, eq, lt, isNotNull, or } from 'drizzle-orm';
import { linkingCodes, idempotencyKeys, refreshTokens } from '../db/schema';

export async function codeExpiryJob(container: Container) {
  const { db, logger } = container;

  // Expire pending linking codes.
  const expiredCodes = await db
    .update(linkingCodes)
    .set({ status: 'expired' })
    .where(and(
      eq(linkingCodes.status, 'pending'),
      lt(linkingCodes.expires_at, sql`NOW()`),
    ))
    .returning({ id: linkingCodes.id });

  // Delete expired idempotency keys.
  const deletedKeys = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expires_at, sql`NOW()`))
    .returning({ key: idempotencyKeys.key });

  // Prune refresh tokens that are either:
  //  - past their expires_at (no value remaining), OR
  //  - revoked AND past expires_at (kept solely to detect replay until expiry).
  // Active, unexpired tokens are NEVER touched by this job.
  const prunedTokens = await db
    .delete(refreshTokens)
    .where(or(
      lt(refreshTokens.expires_at, sql`NOW()`),
      and(isNotNull(refreshTokens.revoked_at), lt(refreshTokens.expires_at, sql`NOW()`)),
    ))
    .returning({ id: refreshTokens.id });

  if (expiredCodes.length > 0 || deletedKeys.length > 0 || prunedTokens.length > 0) {
    logger.info(
      {
        expiredCodes: expiredCodes.length,
        deletedKeys: deletedKeys.length,
        prunedRefreshTokens: prunedTokens.length,
      },
      'codeExpiryJob: cleanup complete',
    );
  }
}
