import type { Container } from '../../config/container';
import { updatePatientProfile, getPatientWithProfile } from '../../db/queries/patients.queries';
import { extractStorageKey } from '../../services/storage';

type Deps = Pick<Container, 'db' | 'storage' | 'logger'>;

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
    avatar_url?: string | null;
  };
};

export async function execute(deps: Deps, input: UpdateProfileInput) {
  const { db, storage, logger } = deps;
  const { avatar_url } = input.fields;

  // Mirror the provider path — if avatar_url is explicitly set (new URL or
  // null), queue deletion of the old blob so we don't orphan storage. The
  // orphanFileCleanupJob is the safety net for failures here.
  let previousAvatarKey: string | null = null;
  if (avatar_url !== undefined) {
    const existing = await getPatientWithProfile(db, input.userId);
    if (existing?.avatar_url && existing.avatar_url !== avatar_url) {
      previousAvatarKey = extractStorageKey(existing.avatar_url, 'avatars');
    }
  }

  await updatePatientProfile(db, input.userId, input.fields);

  if (previousAvatarKey) {
    storage.delete(previousAvatarKey).catch((err: Error) => {
      logger.warn({ err, key: previousAvatarKey }, 'avatar cleanup on replace failed');
    });
  }

  return (await getPatientWithProfile(db, input.userId))!;
}
