import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  verifyProviderLink,
  findExerciseById,
  findLiveAssignment,
  insertAssignment,
} from '../../db/queries/providers.queries';
import { getPatientName } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type CreateAssignmentInput = {
  providerId: string;
  patientId: string;
  exerciseId: string;
  frequency: string;
  sets: number;
};

export async function execute(deps: Deps, input: CreateAssignmentInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const exercise = await findExerciseById(deps.db, input.exerciseId, input.providerId);
  if (!exercise) throw new AppError(404, 'NOT_FOUND', 'Exercise not found in your library.');

  // Reject a duplicate before inserting, so the caller gets an explanatory 409
  // rather than a raw 23505 from idx_ea_unique_live_per_provider. The index
  // remains the real guarantee — this check can still lose a race, and the
  // constraint is what actually prevents the row.
  const existing = await findLiveAssignment(
    deps.db, input.providerId, input.patientId, input.exerciseId,
  );
  if (existing) {
    throw new AppError(
      409,
      'ASSIGNMENT_EXISTS',
      'This exercise is already on the patient\'s plan. Update or remove the existing assignment instead.',
    );
  }

  const assignment = await insertAssignment(deps.db, {
    exercise_id: input.exerciseId,
    patient_id: input.patientId,
    provider_id: input.providerId,
    frequency: input.frequency,
    sets: input.sets,
  });

  const patientName = await getPatientName(deps.db, input.patientId).catch(() => null);
  deps.notify.notify({
    userId: input.patientId,
    type: 'exercise_assigned',
    title: 'New exercise assigned',
    body: exercise.title,
    data: {
      assignmentId: assignment.id,
      exerciseId: input.exerciseId,
      exerciseTitle: exercise.title,
      frequency: input.frequency,
      sets: input.sets,
      patientName: patientName ?? '',
    },
  }).catch((err) => deps.logger.warn({ err, assignmentId: assignment.id }, 'Exercise assignment notification failed'));

  return assignment;
}
