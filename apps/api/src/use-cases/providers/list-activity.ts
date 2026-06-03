import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { auditLogs } from '../../db/schema';
import { getActivityEventConfig } from '../../utils/activity-event-map';

type Deps = Pick<Container, 'db'>;

const PROVIDER_VISIBLE_ACTIONS = [
  'auth.login.success',
  'auth.login.failed',
  'auth.logout',
  'auth.logout_all',
  'auth.password_reset',
  'auth.change_password',
  'auth.mfa_enabled',
  'auth.mfa_verify',
  'auth.email_change_requested',
  'auth.email_change_verified',
  'session_revoked',
  'provider_profile_updated',
] as const;

export type ListActivityInput = {
  userId: string;
  limit: number;
  offset: number;
};

export async function execute(deps: Deps, input: ListActivityInput) {
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
        inArray(auditLogs.action, PROVIDER_VISIBLE_ACTIONS as unknown as string[]),
      ),
    )
    .orderBy(desc(auditLogs.created_at))
    .limit(input.limit + 1)
    .offset(input.offset);

  const items = rows.slice(0, input.limit).map((r) => {
    const eventConfig = getActivityEventConfig(r.action);
    return {
      ...r,
      title: eventConfig.title,
      category: eventConfig.category,
      status: eventConfig.status,
      ip_address: r.ip_address ? String(r.ip_address) : null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    };
  });

  return { items, hasMore: rows.length > input.limit };
}
