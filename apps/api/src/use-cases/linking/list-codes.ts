import type { Container } from '../../config/container';
import { listProviderCodes } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export type ListCodesInput = { providerId: string };

export async function execute(deps: Deps, input: ListCodesInput) {
  return listProviderCodes(deps.db, input.providerId);
}
