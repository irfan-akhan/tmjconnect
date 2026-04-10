import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { auditLog } from '../middleware/audit';
import { createReminderSchema, updateReminderSchema } from '@tmjconnect/shared';
import * as List from '../use-cases/reminders/list';
import * as Create from '../use-cases/reminders/create';
import * as Update from '../use-cases/reminders/update';
import * as Delete from '../use-cases/reminders/delete';

export function remindersRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  router.get('/', async (req, res, next) => {
    try {
      res.json({ data: await List.execute(container, { userId: req.user!.id }) });
    } catch (err) { next(err); }
  });

  router.post('/', validate(createReminderSchema), auditLog('reminder_created', 'reminder'), async (req, res, next) => {
    try {
      res.status(201).json({ data: await Create.execute(container, { userId: req.user!.id, ...req.body }) });
    } catch (err) { next(err); }
  });

  router.patch('/:id', validate(updateReminderSchema), auditLog('reminder_updated', 'reminder'), async (req, res, next) => {
    try {
      res.json({ data: await Update.execute(container, { userId: req.user!.id, id: req.params.id, ...req.body }) });
    } catch (err) { next(err); }
  });

  router.delete('/:id', auditLog('reminder_deleted', 'reminder'), async (req, res, next) => {
    try {
      await Delete.execute(container, { userId: req.user!.id, id: req.params.id });
      res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
