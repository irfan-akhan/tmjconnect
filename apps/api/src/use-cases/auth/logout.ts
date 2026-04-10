import type { Container } from '../../config/container';
import { revokeRefreshTokenByHash } from '../../db/queries/auth.queries';
import { hashToken } from '../../utils/hash';

type Deps = Pick<Container, 'db'>;

export type LogoutInput = { tokenValue: string | undefined };

export async function execute(deps: Deps, input: LogoutInput): Promise<void> {
  if (!input.tokenValue) return;
  // Soft-revoke (not delete) so a future replay of the same token is still
  // detected as a revoked row rather than "unknown" — see refresh-token use-case.
  await revokeRefreshTokenByHash(deps.db, hashToken(input.tokenValue));
}
