import type { Container } from '../../config/container';
import { countMyReports, listMyReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;
type SortOrder = 'asc' | 'desc';

export type PatientInboxInput = {
  patientId: string;
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'urgency';
  sortOrder?: SortOrder;
  urgency?: 'routine' | 'concerning' | 'urgent';
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: PatientInboxInput) {
  const { patientId, limit, offset, sortBy, sortOrder = 'desc', ...filters } = input;
  const [items, total] = await Promise.all([
    listMyReports(deps.db, patientId, limit, offset, filters, sortBy, sortOrder),
    countMyReports(deps.db, patientId, filters),
  ]);
  return {
    items,
    meta: { limit, offset, total, hasMore: offset + limit < total, sortBy, sortOrder },
  };
}
