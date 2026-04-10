import type { Container } from '../../config/container';
import { listActiveAssignments } from '../../db/queries/exercises.queries';

type Deps = Pick<Container, 'db'>;

export type GetAssignmentsInput = { patientId: string };

export async function execute(deps: Deps, input: GetAssignmentsInput) {
  return listActiveAssignments(deps.db, input.patientId);
}
