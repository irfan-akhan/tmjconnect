import type { Container } from '../../config/container';
import { getSymptomCalendar } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type GetCalendarInput = { user: ScopedUser; year: number; month: number };

export async function execute(deps: Deps, input: GetCalendarInput) {
  // Calendar is patient-only: route guards this with authorize('patient').
  return getSymptomCalendar(deps.db, input.user.id, input.year, input.month);
}
