import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { verifyProviderLink } from '../../db/queries/providers.queries';
import { listProviderReports, countProviderReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ListPatientReportsInput = {
  providerId: string;
  patientId: string;
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'urgency' | 'status';
  sortOrder?: SortOrder;
  status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  urgency?: 'routine' | 'concerning' | 'urgent';
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: ListPatientReportsInput) {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const { providerId, patientId, limit, offset, sortBy, sortOrder = 'desc', ...rest } = input;
  const filters = { ...rest, patient_id: patientId };
  const [items, total] = await Promise.all([
    listProviderReports(deps.db, providerId, limit, offset, filters, sortBy, sortOrder),
    countProviderReports(deps.db, providerId, filters),
  ]);
  return {
    items,
    meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder },
  };
}
