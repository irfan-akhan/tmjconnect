import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { listProviderReports, countProviderReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type ListPatientReportsInput = {
  providerId: string;
  patientId: string;
  page: number;
  limit: number;
  status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  urgency?: 'routine' | 'concerning' | 'urgent';
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListPatientReportsInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const { providerId, patientId, page, limit, ...rest } = input;
  const filters = { ...rest, patient_id: patientId };
  const [items, total] = await Promise.all([
    listProviderReports(deps.db, providerId, page, limit, filters),
    countProviderReports(deps.db, providerId, filters),
  ]);
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
