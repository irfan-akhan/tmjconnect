/**
 * Returns the server's canonical TOS version + whether the authenticated
 * user has already accepted it. Drives the mobile app's "re-agreement"
 * screen — if `accepted === false`, the client forces a blocking modal.
 */

import { eq } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { CURRENT_TOS_PUBLISHED_AT, CURRENT_TOS_VERSION } from '../../config/tos';
import { users } from '../../db/schema';

type Deps = Pick<Container, 'db'>;

export async function execute(deps: Deps, userId: string) {
  const [row] = await deps.db
    .select({
      tos_version: users.tos_version,
      tos_accepted_at: users.tos_accepted_at,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const accepted_version = row?.tos_version ?? null;
  const accepted = accepted_version === CURRENT_TOS_VERSION;

  return {
    current_version: CURRENT_TOS_VERSION,
    published_at: CURRENT_TOS_PUBLISHED_AT,
    accepted,
    accepted_version,
    accepted_at: row?.tos_accepted_at
      ? new Date(row.tos_accepted_at).toISOString()
      : null,
  };
}
