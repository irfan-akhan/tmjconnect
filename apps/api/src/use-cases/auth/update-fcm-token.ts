import type { Container } from '../../config/container';
import { updateUserFcmToken } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateFcmTokenInput = { userId: string; fcmToken: string };

export async function execute(deps: Deps, input: UpdateFcmTokenInput): Promise<void> {
  await updateUserFcmToken(deps.db, input.userId, input.fcmToken);
}
