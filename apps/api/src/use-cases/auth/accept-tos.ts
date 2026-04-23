/**
 * Accepts the current TOS version on behalf of an authenticated user.
 *
 * We intentionally allow accepting *any* advertised version string the
 * client sends (not just the server's CURRENT_TOS_VERSION) — lets us retire
 * old versions gracefully. The handler records it literally and lets the
 * /auth/tos/current check compare the recorded value against the canonical
 * constant later.
 */

import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { users } from '../../db/schema';

type Deps = Pick<Container, 'db'>;

export type AcceptTosInput = { userId: string; version: string };

export async function execute(deps: Deps, input: AcceptTosInput) {
  await deps.db
    .update(users)
    .set({
      tos_version: input.version,
      tos_accepted_at: sql`NOW()`,
      updated_at: sql`NOW()`,
    })
    .where(eq(users.id, input.userId));
  return { ok: true as const };
}
