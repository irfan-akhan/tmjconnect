import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { notificationListQuerySchema } from '@tmjconnect/shared';
import { parseCursorPagination, buildCursorMeta } from '../utils/pagination';
import * as List from '../use-cases/notifications/list';
import * as MarkAllRead from '../use-cases/notifications/mark-all-read';
import * as MarkOneRead from '../use-cases/notifications/mark-one-read';

export function notificationsRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate(notificationListQuerySchema, 'query'), auditLog('notifications_viewed', 'notification'), async (req, res, next) => {
    try {
      const { cursor, limit } = parseCursorPagination(req.query);
      const { items, hasMore, unread_count } = await List.execute(container, { user: req.user!, cursor, limit });
      const meta = buildCursorMeta(items, limit, 'created_at');
      res.json({ data: items, meta: { ...meta, hasMore }, unread_count });
    } catch (err) { next(err); }
  });

  // Must be defined before /:id/read to prevent route conflict.
  router.patch('/read-all', auditLog('notifications_marked_all_read', 'notification'), async (req, res, next) => {
    try {
      await MarkAllRead.execute(container, { user: req.user! });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  router.patch('/:id/read', auditLog('notification_marked_read', 'notification'), async (req, res, next) => {
    try {
      res.json({ data: await MarkOneRead.execute(container, { user: req.user!, notifId: req.params.id }) });
    } catch (err) { next(err); }
  });

  return router;
}
