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
  if (input.patientId) {
    return listRequestsForPatientByProvider(deps.db, input.patientId, input.providerId);
  }
  return listRequestsByProvider(deps.db, input.providerId, input.status);
}

export async function executeForPatient(deps: Deps, patientId: string) {
  return listPendingRequestsForPatient(deps.db, patientId);
}
