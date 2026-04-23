import type { Container } from '../../config/container';
import { upsertSymptomLog } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type UpsertLogInput = {
  user: ScopedUser;
  pain_level: number;
  pain_types: string[];
  body_areas: unknown;
  duration_minutes?: number | null;
  triggers: string[];
  notes?: string | null;
  logged_at?: string;
};

export async function execute(deps: Deps, input: UpsertLogInput) {
  const loggedAt = input.logged_at ? new Date(input.logged_at) : new Date();
  return upsertSymptomLog(deps.db, input.user, {
    pain_level: input.pain_level,
    pain_types: input.pain_types,
    body_areas: input.body_areas,
    duration_minutes: input.duration_minutes,
    triggers: input.triggers,
    notes: input.notes,
    logged_at: loggedAt,
  });
}
