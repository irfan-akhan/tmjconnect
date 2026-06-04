/**
 * support-tickets.queries.ts — DB I/O for provider-submitted support tickets.
 */
import { asc, eq, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { supportTickets } from '../schema';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

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
  offset = 0,
  sortBy: 'created_at' | 'category' | 'status' = 'created_at',
  sortOrder: SortOrder = 'desc',
): Promise<SupportTicket[]> {
  const column = sortBy === 'category' ? supportTickets.category : sortBy === 'status' ? supportTickets.status : supportTickets.created_at;
  const orderBy = sortOrder === 'asc' ? asc(column) : desc(column);
  let query = db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.user_id, userId))
    .orderBy(orderBy, desc(supportTickets.created_at))
    .limit(limit);
  (query as any) = query.offset(offset);
  return query;
}
