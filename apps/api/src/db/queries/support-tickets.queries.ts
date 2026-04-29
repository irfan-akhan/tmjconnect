/**
 * support-tickets.queries.ts — DB I/O for provider-submitted support tickets.
 */
import { eq, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { supportTickets } from '../schema';

type DbClient = Db['db'];

export type SupportTicket = typeof supportTickets.$inferSelect;

export async function insertSupportTicket(
  db: DbClient,
  data: {
    user_id: string;
    category: string;
    subject: string;
    body: string;
    attach_diagnostic: boolean;
  },
): Promise<SupportTicket> {
  const [row] = await db.insert(supportTickets).values(data).returning();
  return row;
}

export async function listSupportTicketsForUser(
  db: DbClient,
  userId: string,
  limit = 20,
): Promise<SupportTicket[]> {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.user_id, userId))
    .orderBy(desc(supportTickets.created_at))
    .limit(limit);
}
