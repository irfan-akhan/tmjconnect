/**
 * Utilities for handling paginated list API responses
 * Provides standard pagination, filtering, and sorting helpers
 */

/**
 * Parse common list query parameters
 */
export function parseListQuery(query: any): {
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
} {
  return {
    limit: Math.min(parseInt(query.limit || '10'), 100),
    offset: Math.max(parseInt(query.offset || '0'), 0),
    sortBy: query.sortBy || undefined,
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
    search: query.search || undefined,
  };
}

/**
 * Build standard list response metadata
 */
export function buildListMeta(
  itemsCount: number,
  limit: number,
  offset: number,
  total?: number,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  return {
    limit,
    offset,
    hasMore: total !== undefined ? offset + limit < total : itemsCount === limit,
    total,
    sortBy,
    sortOrder,
  };
}

/**
 * Build complete list response
 */
export function buildListResponse<T>(
  items: T[],
  limit: number,
  offset: number,
  total?: number,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  return {
    data: items,
    meta: buildListMeta(items.length, limit, offset, total, sortBy, sortOrder),
  };
}
