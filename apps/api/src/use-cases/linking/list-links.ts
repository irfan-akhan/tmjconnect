import type { Container } from '../../config/container';
import { listUserLinks } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db'>;

export type ListLinksInput = { userId: string; role: string };

export async function execute(deps: Deps, input: ListLinksInput) {
  return listUserLinks(deps.db, input.userId, input.role);
}
