import type { Container } from '../../config/container';
import { updateProviderProfile, getProviderWithProfile } from '../../db/queries/providers.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateProfileInput = {
  userId: string;
  fields: {
    first_name?: string;
    last_name?: string;
    city?: string | null;
    state?: string | null;
    timezone?: string;
    license_number?: string;
    license_type?: string;
    specialty?: string;
    clinic_name?: string;
    credentials?: string[] | null;
  };
};

export async function execute(deps: Deps, input: UpdateProfileInput) {
  const { first_name, last_name, city, state, timezone, ...providerFields } = input.fields;
  await updateProviderProfile(
    deps.db,
    input.userId,
    { first_name, last_name, city, state, timezone },
    providerFields,
  );
  return getProviderWithProfile(deps.db, input.userId);
}
