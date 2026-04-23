import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import * as GetAssignments from '../use-cases/exercises/get-assignments';
import * as CompleteAssignment from '../use-cases/exercises/complete-assignment';

export function exercisesRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.get('/assignments', auditLog('patient_viewed_assignments', 'exercise_assignment'), async (req, res, next) => {
    try {
      res.json({ data: await GetAssignments.execute(container, { user: req.user! }) });
    } catch (err) { next(err); }
  });

  router.post('/assignments/:assignmentId/complete', auditLog('exercise_completed', 'exercise_assignment'), async (req, res, next) => {
    try {
      const { data, alreadyCompleted } = await CompleteAssignment.execute(container, {
        user: req.user!,
        assignmentId: req.params.assignmentId,
      });
      res.status(alreadyCompleted ? 200 : 201).json({ data, alreadyCompleted });
    } catch (err) { next(err); }
  });

  return router;
}
