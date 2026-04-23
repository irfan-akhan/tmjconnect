import type { Container } from '../../config/container';
import {
  listRequestsByProvider,
  listRequestsForPatientByProvider,
  listPendingRequestsForPatient,
} from '../../db/queries/report-requests.queries';

type Deps = Pick<Container, 'db'>;

export type ListProviderRequestsInput = {
  providerId: string;
  patientId?: string;
  status?: 'pending' | 'fulfilled' | 'dismissed';
};

export async function executeForProvider(deps: Deps, input: ListProviderRequestsInput) {
  const provider = { id: input.providerId, role: 'provider' as const };
  if (input.patientId) {
    return listRequestsForPatientByProvider(deps.db, input.patientId, provider);
  }
  return listRequestsByProvider(deps.db, provider, input.status);
}

export async function executeForPatient(deps: Deps, patientId: string) {
  return listPendingRequestsForPatient(deps.db, { id: patientId, role: 'patient' });
}
