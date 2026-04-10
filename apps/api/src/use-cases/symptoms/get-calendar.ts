import type { Container } from '../../config/container';
import { getSymptomCalendar } from '../../db/queries/symptoms.queries';

type Deps = Pick<Container, 'db'>;

export type GetCalendarInput = { userId: string; year: number; month: number };

export async function execute(deps: Deps, input: GetCalendarInput) {
  return getSymptomCalendar(deps.db, input.userId, input.year, input.month);
}
