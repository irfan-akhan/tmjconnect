import { eq, and, type SQL, type AnyColumn } from 'drizzle-orm';
import type { TokenPayload } from '@tmjconnect/shared';
import { sql } from 'drizzle-orm';

/**
 * scopeToUser() — Row-level access control helper.
 *
 * Auto-injects an ownership WHERE clause based on the authenticated user's role.
 * This prevents PHI leakage from a missed WHERE clause in a route handler.
 *
 * Rules:
 * - patient: filters by patient_id or user_id on the table
 * - provider: filters by provider_id or user_id on the table
 * - admin: no filter applied (admin sees all data)
 *
 * Usage:
 *   const logs = await db.select()
 *     .from(symptomLogs)
 *     .where(scopeToUser(undefined, symptomLogs, req.user))
 *
 * For providers viewing patient data, the scope check is two-step:
 *   1. Verify patient is linked to provider via patient_provider_links WHERE unlinked_at IS NULL
 *   2. Then query patient data with the patient_id from the verified link
 * Do NOT use scopeToUser() directly for that case — use verifyProviderLink() instead.
 */
export function scopeToUser(
  baseCondition: SQL | undefined,
  table: {
    patient_id?: AnyColumn;
    user_id?: AnyColumn;
    provider_id?: AnyColumn;
  },
  user: Pick<TokenPayload, 'id' | 'role'>,
): SQL {
  let ownerColumn: AnyColumn | undefined;

  if (user.role === 'patient') {
    ownerColumn = table.patient_id ?? table.user_id;
  } else if (user.role === 'provider') {
    ownerColumn = table.provider_id ?? table.user_id;
  }
  // admin: no scope filter — sees all data

  if (!ownerColumn) {
    return baseCondition ?? sql`TRUE`;
  }

  const scopeFilter = eq(ownerColumn, user.id);
  return baseCondition ? and(baseCondition, scopeFilter)! : scopeFilter;
}

/**
 * ScopedUser — The identity passed to scoped queries. Accepts anything with
 * `id` and `role` (e.g. req.user from the auth middleware).
 */
export type ScopedUser = Pick<TokenPayload, 'id' | 'role'>;
