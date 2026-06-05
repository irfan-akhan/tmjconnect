/**
 * scheduledBroadcastJob — Runs every minute.
 *
 * Finds scheduled broadcasts where scheduled_at <= NOW() and sent_at is still
 * null, dispatches the selected channels, then marks the broadcast sent. The
 * job registry wraps this in an advisory lock, so only one API instance runs it
 * at a time.
 */
import type { Container } from '../config/container';
import { dispatchBroadcast } from '../services/broadcastDispatch';
import { listDueBroadcasts, markBroadcastSent } from '../db/queries/admin-p1p2.queries';

export async function scheduledBroadcastJob(container: Container): Promise<number> {
  const { db, logger } = container;
  const dueBroadcasts = await listDueBroadcasts(db);
  if (dueBroadcasts.length === 0) return 0;

  logger.info({ count: dueBroadcasts.length }, 'scheduledBroadcastJob: dispatching due broadcasts');

  let processed = 0;
  for (const broadcast of dueBroadcasts) {
    try {
      const delivery = await dispatchBroadcast(container, broadcast);
      await markBroadcastSent(db, broadcast.id);
      processed++;
      logger.info({ broadcastId: broadcast.id, ...delivery }, 'scheduledBroadcastJob: broadcast sent');
    } catch (err) {
      logger.error({ err, broadcastId: broadcast.id }, 'scheduledBroadcastJob: failed to dispatch broadcast');
    }
  }

  return processed;
}