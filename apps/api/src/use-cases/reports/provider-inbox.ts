import type { Container } from '../../config/container';
import { listProviderReports, countProviderReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type ProviderInboxInput = {
  providerId: string;
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'urgency' | 'status';
  sortOrder?: SortOrder;
  status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  patient_id?: string;
  from?: string;
  to?: string;
  urgency?: 'routine' | 'concerning' | 'urgent';
};

export async function execute(deps: Deps, input: ProviderInboxInput) {
  const { providerId, limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;
  const [items, total] = await Promise.all([
    listProviderReports(deps.db, providerId, limit, offset, filters, sortBy, sortOrder),
    countProviderReports(deps.db, providerId, filters),
  ]);
  return {
    items,
    meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder },
  };
}
