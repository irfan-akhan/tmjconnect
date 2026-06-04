/**
 * notifications.queries.ts — All database interactions for the notifications module.
 */
import { eq, and, lt, lte, isNull, desc, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { notifications, notificationOutbox } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];

// ─── Notification outbox ───────────────────────────────────────────────────────

export type OutboxChannel = 'email' | 'sms' | 'push';

export type OutboxInsert = {
  user_id: string;
  channel: OutboxChannel;
  type: string;
  payload: Record<string, unknown>;
};

/**
 * insertOutboxRows — Persist one outbox row per channel for a notification.
 * Designed to be called inside the same transaction as the triggering action;
 * pass the transaction client (not the global db) to make the write atomic.
 */
export async function insertOutboxRows(db: DbClient, rows: OutboxInsert[]): Promise<string[]> {
  if (rows.length === 0) return [];
  const inserted = await db
    .insert(notificationOutbox)
    .values(rows)
    .returning({ id: notificationOutbox.id });
  return inserted.map((r) => r.id);
}

/**
 * markOutboxSent — Records a successful dispatch. Used by both the inline send
 * (in notify()) and the drain job.
 */
export async function markOutboxSent(db: DbClient, id: string): Promise<void> {
  await db
    .update(notificationOutbox)
    .set({ sent_at: sql`NOW()`, last_error: null })
    .where(eq(notificationOutbox.id, id));
}

/**
 * markOutboxFailed — Increments attempts, records the error, and schedules
 * the next attempt with exponential backoff (1m, 2m, 4m, 8m, 16m capped).
 * After max_attempts the row stays as a DLQ entry.
 */
export async function markOutboxFailed(
  db: DbClient,
  id: string,
  errorMessage: string,
): Promise<void> {
  // Backoff: pow(2, attempts) minutes, capped at 30. attempts is the value
  // BEFORE increment, so the first retry waits 1 minute and so on.
  await db.execute(sql`
    UPDATE notification_outbox
    SET
      attempts = attempts + 1,
      last_error = ${errorMessage},
      next_attempt_at = NOW() + (LEAST(POWER(2, attempts), 30) || ' minutes')::interval
    WHERE id = ${id}
  `);
}

/**
 * claimPendingOutboxRows — Reserves up to `limit` pending rows for processing.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED so multiple workers (or job ticks)
 * can safely run in parallel without double-sending.
 *
 * The caller MUST be inside a transaction — the lock is released on commit.
 */
export async function claimPendingOutboxRows(db: DbClient, limit: number) {
  const rows = await db
    .select({
      id: notificationOutbox.id,
      user_id: notificationOutbox.user_id,
      channel: notificationOutbox.channel,
      type: notificationOutbox.type,
      payload: notificationOutbox.payload,
      attempts: notificationOutbox.attempts,
      max_attempts: notificationOutbox.max_attempts,
      next_attempt_at: notificationOutbox.next_attempt_at,
      sent_at: notificationOutbox.sent_at,
      last_error: notificationOutbox.last_error,
      created_at: notificationOutbox.created_at,
    })
    .from(notificationOutbox)
    .where(
      and(
        isNull(notificationOutbox.sent_at),
        lte(notificationOutbox.next_attempt_at, sql`NOW()`),
        sql`${notificationOutbox.attempts} < ${notificationOutbox.max_attempts}`,
      ),
    )
    .orderBy(notificationOutbox.next_attempt_at)
    .limit(limit)
    .for('update', { skipLocked: true });
  return rows;
}

/** countOutboxDLQ — Number of rows that have exhausted max_attempts. */
export async function countOutboxDLQ(db: DbClient): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM notification_outbox
    WHERE sent_at IS NULL AND attempts >= max_attempts
  `);
  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.count ?? '0', 10);
}

export async function listNotifications(
  db: DbClient,
  user: ScopedUser,
  cursor: Date | null,
  limit: number,
) {
  const baseCondition = cursor ? lt(notifications.created_at, cursor) : undefined;
  return db
    .select()
    .from(notifications)
    .where(scopeToUser(baseCondition, notifications, user))
    .orderBy(desc(notifications.created_at))
    .limit(limit + 1); // extra row for hasMore detection
}

export async function countUnread(db: DbClient, user: ScopedUser): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(scopeToUser(eq(notifications.read, false), notifications, user));
  return row?.count ?? 0;
}

export async function markAllNotificationsRead(db: DbClient, user: ScopedUser) {
  await db
    .update(notifications)
    .set({ read: true, read_at: sql`NOW()` })
    .where(scopeToUser(eq(notifications.read, false), notifications, user));
}

export async function markNotificationRead(
  db: DbClient,
  notifId: string,
  user: ScopedUser,
) {
  const [row] = await db
    .update(notifications)
    .set({ read: true, read_at: sql`NOW()` })
    .where(scopeToUser(eq(notifications.id, notifId), notifications, user))
    .returning();
  return row ?? null;
}
