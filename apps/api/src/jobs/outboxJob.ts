/**
 * outboxJob — Drains the notification_outbox table.
 *
 * Runs every minute. Each tick:
 *  1. Inside a transaction, claim up to BATCH_SIZE pending rows whose
 *     next_attempt_at <= NOW(), using SELECT ... FOR UPDATE SKIP LOCKED.
 *  2. For each row, dispatch via the same code path as the inline send in
 *     notify() (services/notifyDispatch.ts). Mark sent on success, schedule
 *     a retry with exponential backoff on failure.
 *  3. Log the DLQ count if any rows have exhausted max_attempts so an operator
 *     can intervene.
 *
 * The transaction lasts the entire batch — rows stay locked until either the
 * batch commits (success: sent_at set; failure: attempts++/next_attempt_at
 * advanced) or the worker dies and the lock is released.
 */
import type { Container } from '../config/container';
import {
  claimPendingOutboxRows,
  markOutboxSent,
  markOutboxFailed,
  countOutboxDLQ,
} from '../db/queries/notifications.queries';
import { dispatchOutboxRow } from '../services/notifyDispatch';
import type { NotificationType } from '@tmjconnect/shared';

const BATCH_SIZE = 100;

export async function outboxJob(container: Container): Promise<void> {
  const { db, email, sms, push, logger } = container;

  // Process batches inside a transaction so SKIP LOCKED is honoured.
  // The transaction commits at the end; updates inside (sent / failed) are atomic.
  const sentIds: string[] = [];
  const failedIds: string[] = [];

  await db.transaction(async (tx) => {
    const batch = await claimPendingOutboxRows(tx, BATCH_SIZE);
    if (batch.length === 0) return;

    for (const row of batch) {
      try {
        await dispatchOutboxRow(
          { email, sms, push },
          {
            channel: row.channel,
            type: row.type as NotificationType,
            payload: row.payload as Record<string, unknown>,
          },
        );
        await markOutboxSent(tx, row.id);
        sentIds.push(row.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markOutboxFailed(tx, row.id, message);
        failedIds.push(row.id);
      }
    }
  });

  if (sentIds.length > 0 || failedIds.length > 0) {
    logger.info(
      { sent: sentIds.length, failed: failedIds.length },
      'outboxJob: batch processed',
    );
  }

  // DLQ alert: rows that exhausted max_attempts. Operator-actionable.
  const dlqCount = await countOutboxDLQ(db);
  if (dlqCount > 0) {
    logger.warn({ dlqCount }, 'outboxJob: dead-letter queue has unresolved entries');
  }
}
