/**
 * support-tickets.queries.ts — DB I/O for provider-submitted support tickets.
 */
import { asc, eq, desc, sql } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { supportTickets } from '../schema';

type DbClient = Db['db'];
type SortOrder = 'asc' | 'desc';

export type SupportTicket = typeof supportTickets.$inferSelect;

export type AdminSupportTicketListFilters = {
  search?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  category?: 'technical' | 'billing' | 'clinical' | 'feature' | 'other';
};

export type AdminSupportTicketListRow = SupportTicket & {
  user_email: string;
  first_name: string | null;
  last_name: string | null;
};

export type AdminSupportTicketDetail = AdminSupportTicketListRow;

function sortDirection(sortOrder: SortOrder = 'desc') {
  return sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
}

function buildAdminSupportTicketFilters(filters: AdminSupportTicketListFilters) {
  const search = filters.search?.trim().toLowerCase();
  return sql`
    TRUE
    ${search
      ? sql`AND (
          LOWER(st.subject) LIKE ${`%${search}%`}
          OR LOWER(st.body) LIKE ${`%${search}%`}
          OR LOWER(u.email) LIKE ${`%${search}%`}
          OR LOWER(COALESCE(p.first_name, '')) LIKE ${`%${search}%`}
          OR LOWER(COALESCE(p.last_name, '')) LIKE ${`%${search}%`}
        )`
      : sql``}
    ${filters.status ? sql`AND st.status = ${filters.status}` : sql``}
    ${filters.category ? sql`AND st.category = ${filters.category}` : sql``}
  `;
}

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

export async function listSupportTicketsForAdmin(
  db: DbClient,
  limit: number,
  offset: number,
  filters: AdminSupportTicketListFilters,
  sortBy: 'created_at' | 'status' | 'category' | 'email' = 'created_at',
  sortOrder: SortOrder = 'desc',
): Promise<AdminSupportTicketListRow[]> {
  const where = buildAdminSupportTicketFilters(filters);
  const orderBy = {
    created_at: sql`st.created_at`,
    status: sql`st.status`,
    category: sql`st.category`,
    email: sql`u.email`,
  }[sortBy] ?? sql`st.created_at`;
  const orderDir = sortDirection(sortOrder);

  const result = await db.execute<AdminSupportTicketListRow>(sql`
    SELECT
      st.id,
      st.user_id,
      st.category,
      st.subject,
      st.body,
      st.attach_diagnostic,
      st.status,
      st.created_at,
      st.updated_at,
      u.email AS user_email,
      p.first_name,
      p.last_name
    FROM support_tickets st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN profiles p ON p.user_id = st.user_id
    WHERE ${where}
    ORDER BY ${orderBy} ${orderDir}, st.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return Array.isArray(result) ? result : result.rows ?? [];
}

export async function countSupportTicketsForAdmin(
  db: DbClient,
  filters: AdminSupportTicketListFilters,
): Promise<number> {
  type CountRow = { total: string };
  const where = buildAdminSupportTicketFilters(filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total
    FROM support_tickets st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN profiles p ON p.user_id = st.user_id
    WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function getSupportTicketForAdmin(
  db: DbClient,
  ticketId: string,
): Promise<AdminSupportTicketDetail | null> {
  const result = await db.execute<AdminSupportTicketDetail>(sql`
    SELECT
      st.id,
      st.user_id,
      st.category,
      st.subject,
      st.body,
      st.attach_diagnostic,
      st.status,
      st.created_at,
      st.updated_at,
      u.email AS user_email,
      p.first_name,
      p.last_name
    FROM support_tickets st
    JOIN users u ON u.id = st.user_id
    LEFT JOIN profiles p ON p.user_id = st.user_id
    WHERE st.id = ${ticketId}
    LIMIT 1
  `);
  const rows: AdminSupportTicketDetail[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows[0] ?? null;
}
