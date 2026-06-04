/**
 * Patient-facing view of their own account activity — pulls from the
 * HIPAA audit trail, but exposes only a whitelist of actions the user
 * would recognise (logins, password/email changes, link/unlink events).
 *
 * We do NOT expose clinical actions (symptom logs, report submits) here —
 * those are already surfaced in-app through their own screens, and
 * listing them as audit events feels redundant + leaky about how the
 * audit layer is structured.
 */

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { auditLogs } from '../../db/schema';
import { getActivityEventConfig } from '../../utils/activity-event-map';
import { parseDevice } from '../../utils/parse-device';
import { lookupLocations } from '../../utils/lookup-location';

type Deps = Pick<Container, 'db'>;

/**
 * Which audit `action` strings surface to the patient as "activity". Kept
 * narrow on purpose: add to this list only when we're sure the action is
 * user-facing and non-PHI.
 */
const PATIENT_VISIBLE_ACTIONS = [
  'auth.login.success',
  'auth.login.failed',
  'auth.logout',
  'auth.password_reset',
  'auth.change_password',
  'auth.mfa_enabled',
  'auth.mfa_disabled',
  'auth.email_change_requested',
  'auth.email_change_verified',
  'session_revoked',
  'linking_code_accepted',
  'link_disconnected',
] as const;

export type ListActivityInput = {
  userId: string;
  limit: number;
  offset: number;
  sortBy?: 'created_at' | 'action';
  sortOrder?: 'asc' | 'desc';
};

export async function execute(deps: Deps, input: ListActivityInput) {
  const sortColumn = input.sortBy === 'action' ? auditLogs.action : auditLogs.created_at;
  const orderBy = input.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const rows = await deps.db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resource_type: auditLogs.resource_type,
      ip_address: auditLogs.ip_address,
      user_agent: auditLogs.user_agent,
      created_at: auditLogs.created_at,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.user_id, input.userId),
        inArray(auditLogs.action, PATIENT_VISIBLE_ACTIONS as unknown as string[]),
      ),
    )
    .orderBy(orderBy, desc(auditLogs.created_at))
    .limit(input.limit + 1)
    .offset(input.offset);

  const visible = rows.slice(0, input.limit);
  const locations = await lookupLocations(visible.map((r) => r.ip_address ? String(r.ip_address) : null));

  const items = visible.map((r) => {
    const eventConfig = getActivityEventConfig(r.action);
    const ip = r.ip_address ? String(r.ip_address) : null;
    return {
      ...r,
      title: eventConfig.title,
      category: eventConfig.category,
      status: eventConfig.status,
      device: parseDevice(r.user_agent),
      location: ip ? (locations.get(ip) ?? 'Unknown') : 'Unknown',
      ip_address: ip,
      created_at: r.created_at instanceof Date
        ? r.created_at.toISOString()
        : r.created_at,
    };
  });

  return { items, hasMore: rows.length > input.limit };
}
