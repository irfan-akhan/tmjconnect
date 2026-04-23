import type { Container } from '../../config/container';
import { countMyReports, listMyReports } from '../../db/queries/reports.queries';

type Deps = Pick<Container, 'db'>;

export type PatientInboxInput = {
  patientId: string;
  page: number;
  limit: number;
  urgency?: 'routine' | 'concerning' | 'urgent';
  from?: string;
  to?: string;
};

export async function execute(deps: Deps, input: PatientInboxInput) {
  const { patientId, page, limit, ...filters } = input;
  const [items, total] = await Promise.all([
    listMyReports(deps.db, patientId, page, limit, filters),
    countMyReports(deps.db, patientId, filters),
  ]);
  return {
    items,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
  };
}
