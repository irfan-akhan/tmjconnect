import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { disconnectLink, getLinkParticipants } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type DisconnectInput = { userId: string; linkId: string };

export async function execute(deps: Deps, input: DisconnectInput) {
  const participants = await getLinkParticipants(deps.db, input.linkId);
  const disconnected = await disconnectLink(deps.db, input.linkId, input.userId);
  if (!disconnected) throw new AppError(404, 'NOT_FOUND', 'Link not found or already disconnected.');
  if (!participants) return;

  const patientName = `${participants.patient_first_name ?? ''} ${participants.patient_last_name ?? ''}`.trim() || 'your patient';
  const providerName = `${participants.provider_first_name ?? ''} ${participants.provider_last_name ?? ''}`.trim() || 'your provider';

  deps.email.sendLinkDisconnected(participants.patient_email, participants.patient_first_name ?? '', providerName)
    .catch((err) => deps.logger.warn({ err, linkId: input.linkId, userId: participants.patient_id }, 'Patient disconnect email failed'));
  deps.email.sendLinkDisconnected(participants.provider_email, participants.provider_first_name ?? '', patientName)
    .catch((err) => deps.logger.warn({ err, linkId: input.linkId, userId: participants.provider_id }, 'Provider disconnect email failed'));
}
