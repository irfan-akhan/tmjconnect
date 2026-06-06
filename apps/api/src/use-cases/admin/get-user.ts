import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { getUserDetail } from '../../db/queries/admin.queries';
import { listAuditLogs, listLoginEvents } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type GetUserInput = { userId: string };

export async function execute(deps: Deps, input: GetUserInput) {
  const user = await getUserDetail(deps.db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const [recentAudit, recentLogins] = await Promise.all([
    listAuditLogs(deps.db, 20, 0, { user_id: input.userId }),
    listLoginEvents(deps.db, 20, 0, { user_id: input.userId }),
  ]);

  return { user, recent_audit_logs: recentAudit, recent_login_events: recentLogins };
}
