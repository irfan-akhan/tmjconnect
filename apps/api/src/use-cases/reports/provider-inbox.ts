import type { Container } from '../../config/container';
import { listProviderReports, countProviderReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type ProviderInboxInput = {
  providerId: string;
  page: number;
  limit: number;
  status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  patient_id?: string;
  from?: string;
  to?: string;
  urgency?: 'routine' | 'concerning' | 'urgent';
};

export async function execute(deps: Deps, input: ProviderInboxInput) {
  const { providerId, page, limit, ...filters } = input;
  const [items, total] = await Promise.all([
    listProviderReports(deps.db, providerId, page, limit, filters),
    countProviderReports(deps.db, providerId, filters),
  ]);
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
