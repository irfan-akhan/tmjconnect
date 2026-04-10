import { eq, and } from 'drizzle-orm';
import type { Db } from '../../src/config/database';
import { auditLogs } from '../../src/db/schema';

type DbClient = Db['db'];
type AuditLogRow = typeof auditLogs.$inferSelect;

/**
 * waitForAuditEntry — Polls the audit_logs table until a row matching the
 * given action+user appears (or the timeout elapses).
 *
 * The audit middleware writes rows on `res.on('finish')` — fire-and-forget,
 * after the HTTP response. So tests can't observe the row synchronously after
 * supertest returns; they must poll for it briefly.
 */
export async function waitForAuditEntry(
  db: DbClient,
  options: { action: string; userId?: string | null; resourceType?: string },
  timeoutMs = 1000,
): Promise<AuditLogRow | undefined> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const conditions = [eq(auditLogs.action, options.action)];
    if (options.userId !== undefined && options.userId !== null) {
      conditions.push(eq(auditLogs.user_id, options.userId));
    }
    if (options.resourceType !== undefined) {
      conditions.push(eq(auditLogs.resource_type, options.resourceType));
    }
    const rows = await db.select().from(auditLogs).where(and(...conditions));
    if (rows.length > 0) return rows[0];
    await new Promise((r) => setTimeout(r, 25));
  }
  return undefined;
}

/**
 * expectAuditEntry — assertion form. Fails the test if no matching row appears
 * within the timeout. Returns the row so the caller can make further assertions.
 */
export async function expectAuditEntry(
  db: DbClient,
  options: { action: string; userId?: string | null; resourceType?: string },
  timeoutMs = 1000,
): Promise<AuditLogRow> {
  const entry = await waitForAuditEntry(db, options, timeoutMs);
  if (!entry) {
    throw new Error(
      `Expected audit entry not found within ${timeoutMs}ms. Filter: ${JSON.stringify(options)}`,
    );
  }
  return entry;
}
