import type { Container } from '../../config/container';
import { updateProviderProfile, getProviderWithProfile } from '../../db/queries/providers.queries';
import { extractStorageKey } from '../../services/storage';

type Deps = Pick<Container, 'db' | 'storage' | 'logger'>;

export type UpdateProfileInput = {
  userId: string;
  fields: {
    first_name?: string;
    last_name?: string;
    city?: string | null;
    state?: string | null;
    timezone?: string;
    avatar_url?: string | null;
    license_number?: string;
    license_type?: string;
    specialty?: string;
    clinic_name?: string;
    credentials?: string[] | null;
  };
};

export async function execute(deps: Deps, input: UpdateProfileInput) {
  const { first_name, last_name, city, state, timezone, avatar_url, ...providerFields } = input.fields;

  // If avatar_url is being changed (set to new URL or nulled), delete the
  // old blob to avoid orphaning storage. Best-effort — failures are logged
  // but don't block the profile update. orphanFileCleanupJob is a safety net.
  let previousAvatarKey: string | null = null;
  if (avatar_url !== undefined) {
    const existing = await getProviderWithProfile(deps.db, input.userId);
    if (existing?.avatar_url && existing.avatar_url !== avatar_url) {
      previousAvatarKey = extractStorageKey(existing.avatar_url, 'avatars');
    }
  }

  await updateProviderProfile(
    deps.db,
    input.userId,
    { first_name, last_name, city, state, timezone, avatar_url },
    providerFields,
  );

  if (previousAvatarKey) {
    deps.storage.delete(previousAvatarKey).catch((err: Error) => {
      deps.logger.warn({ err, key: previousAvatarKey }, 'avatar cleanup on replace failed');
    });
  }

  return getProviderWithProfile(deps.db, input.userId);
}
