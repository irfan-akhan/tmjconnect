import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getProviderWithProfile } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type GetProfileInput = { userId: string };

export async function execute(deps: Deps, input: GetProfileInput) {
  const profile = await getProviderWithProfile(deps.db, input.userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Provider profile not found.');
  return profile;
}
