import type { Container } from '../../config/container';
import { updatePatientProfile, getPatientWithProfile } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateProfileInput = {
  userId: string;
  fields: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string | null;
    gender?: string | null;
    city?: string | null;
    state?: string | null;
    timezone?: string;
  };
};

export async function execute(deps: Deps, input: UpdateProfileInput) {
  const { db } = deps;
  await updatePatientProfile(db, input.userId, input.fields);
  return (await getPatientWithProfile(db, input.userId))!;
}
