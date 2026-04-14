import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { dismissRequest, findRequestById } from '../../db/queries/report-requests.queries';

type Deps = Pick<Container, 'db'>;

export type DismissRequestInput = {
  userId: string;
  role: 'patient' | 'provider';
  requestId: string;
};

export async function execute(deps: Deps, input: DismissRequestInput) {
  const existing = await findRequestById(deps.db, input.requestId);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Request not found.');

  // Either the patient who received it or the provider who sent it can dismiss.
  const allowed =
    (input.role === 'patient' && existing.patient_id === input.userId) ||
    (input.role === 'provider' && existing.provider_id === input.userId);
  if (!allowed) throw new AppError(403, 'FORBIDDEN', 'Not allowed to dismiss this request.');

  if (existing.status !== 'pending') {
    throw new AppError(409, 'CONFLICT', `Request is already ${existing.status}.`);
  }

  const updated = await dismissRequest(deps.db, input.requestId);
  if (!updated) throw new AppError(409, 'CONFLICT', 'Request could not be dismissed.');
  return updated;
}
