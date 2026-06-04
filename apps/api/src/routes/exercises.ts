import { Router } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { assignmentListQuerySchema } from '@tmjconnect/shared';
import { parseListQuery, buildListResponse } from '../utils/listHelpers';
import * as GetAssignments from '../use-cases/exercises/get-assignments';
import * as CompleteAssignment from '../use-cases/exercises/complete-assignment';

export function exercisesRouter(container: Container) {
  const router = Router();
  router.use(authenticate, authorize('patient'));

  router.get(
    '/assignments',
    validate(assignmentListQuerySchema, 'query'),
    auditLog('patient_viewed_assignments', 'exercise_assignment'),
    async (req, res, next) => {
      try {
        const baseParams = parseListQuery(req.query);
        const status = req.query.status as string | undefined;
        const data = await GetAssignments.execute(container, {
          user: req.user!,
          ...baseParams,
          status,
        });
        res.json(buildListResponse(data, baseParams.limit, baseParams.offset, undefined, baseParams.sortBy, baseParams.sortOrder));
      } catch (err) {
        next(err);
      }
    },
  );

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
