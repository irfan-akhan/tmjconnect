import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findPendingCode,
  acceptCodeTransaction,
  getProviderName,
  getPatientName,
} from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db' | 'notify' | 'logger'>;

export type AcceptCodeInput = { patientId: string; code: string };

export async function execute(deps: Deps, input: AcceptCodeInput) {
  const { db, notify, logger } = deps;

  const codeRow = await findPendingCode(db, input.code);
  if (!codeRow) throw new AppError(404, 'NOT_FOUND', 'Invalid or expired linking code.');

  if (new Date() > codeRow.expires_at) {
    throw new AppError(410, 'CODE_EXPIRED', 'This linking code has expired.');
  }

  // Atomic: lock code row, check for existing link, update code, insert link.
  const link = await acceptCodeTransaction(db, codeRow.id, input.patientId, codeRow.provider_id);
  if (!link) throw new AppError(409, 'CONFLICT', 'You are already linked to this provider.');

  // Notify both parties (fire-and-forget).
  const [providerName, patientName] = await Promise.all([
    getProviderName(db, codeRow.provider_id),
    getPatientName(db, input.patientId),
  ]).catch(() => [null, null]);

  notify.notify({
    userId: codeRow.provider_id,
    type: 'link_accepted',
    title: 'Patient connected',
    body: `${patientName ?? 'A patient'} has accepted your invitation.`,
    data: { patientId: input.patientId, providerName: providerName ?? '', patientName: patientName ?? '', recipientRole: 'provider' },
  }).catch((err) => logger.warn({ err }, 'Link acceptance notification (provider) failed'));

  notify.notify({
    userId: input.patientId,
    type: 'link_accepted',
    title: 'Connected to provider',
    body: `You are now connected to ${providerName ?? 'your provider'}.`,
    data: { providerId: codeRow.provider_id, providerName: providerName ?? '', patientName: patientName ?? '', recipientRole: 'patient' },
  }).catch((err) => logger.warn({ err }, 'Link acceptance notification (patient) failed'));

  return link;
}
