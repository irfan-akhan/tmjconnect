import type { Container } from '../../config/container';
import { revokeRefreshTokenAndDeleteSession } from '../../db/queries/auth.queries';
import { hashToken } from '../../utils/hash';

type Deps = Pick<Container, 'db'>;

export type LogoutInput = { tokenValue: string | undefined };

export async function execute(deps: Deps, input: LogoutInput): Promise<void> {
  if (!input.tokenValue) return;
  // Soft-revoke the refresh token and delete the associated session.
  await revokeRefreshTokenAndDeleteSession(deps.db, hashToken(input.tokenValue));
}
