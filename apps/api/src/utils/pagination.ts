import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../config/constants';

// ─── Offset-based pagination ───────────────────────────────────────────────────────
// Used for: admin tables, provider dashboards, report inbox, exercise library.
// Response includes total count (useful for pagination UI).

export interface OffsetPaginationParams {
  limit: number;
  offset: number;
}

/**
 * parsePagination(query) — Extracts and clamps offset/limit from query params.
 * Returns { limit, offset } for use in Drizzle .limit() and .offset().
 */
export function parsePagination(query: {
  limit?: string | number;
  offset?: string | number;
}): OffsetPaginationParams {
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT),
  );
  const offset = Math.max(0, parseInt(String(query.offset ?? 0), 10) || 0);
  return { limit, offset };
}

/**
 * buildOffsetMeta(total, offset, limit) — Builds the pagination meta for list responses.
 */
export function buildOffsetMeta(
  total: number,
  offset: number,
  limit: number,
): { total: number; offset: number; limit: number; hasMore: boolean } {
  return {
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  };
}

// ─── Cursor-based pagination ───────────────────────────────────────────────────────
// Used for: symptom_logs, notifications (infinite scroll on mobile).
// No COUNT(*) — uses WHERE logged_at < :cursor for efficient keyset pagination.

export interface CursorPaginationParams {
  cursor: Date | null;
  limit: number;
}

/**
 * parseCursorPagination(query) — Extracts cursor and limit from query params.
 * cursor is a timestamp ISO string. Returns parsed Date or null if absent.
 */
export function parseCursorPagination(query: {
  cursor?: string;
  limit?: string | number;
}): CursorPaginationParams {
  const cursor = query.cursor ? new Date(query.cursor) : null;
  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT),
  );
  return { cursor, limit };
}

/**
 * buildCursorMeta(items, limit, timestampField) — Builds meta for cursor-paginated responses.
 * nextCursor is the timestamp of the last item (used as the next cursor value).
 */
export function buildCursorMeta<T extends Record<string, unknown>>(
  items: T[],
  limit: number,
  timestampField: keyof T,
): { limit: number; nextCursor: string | null; hasMore: boolean } {
  const hasMore = items.length === limit;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? (lastItem[timestampField] as Date).toISOString()
    : null;
  return { limit, nextCursor, hasMore };
}
