import { z } from 'zod';

/**
 * Common query parameters for list endpoints
 * Supports offset-based pagination, filtering, and sorting
 */

export const commonListQuerySchema = z.object({
  // Pagination
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  
  // Sorting
  sortBy: z.string().optional().nullable(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Generic search/filter
  search: z.string().max(255).optional().nullable(),
});

export type CommonListQuery = z.infer<typeof commonListQuerySchema>;

/**
 * Helper type for standard list response metadata
 */
export interface ListResponseMeta {
  limit: number;
  offset: number;
  hasMore: boolean;
  total?: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Helper to build list response with metadata
 */
export function buildListResponse<T>(
  items: T[],
  limit: number,
  offset: number,
  total?: number,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
): { data: T[]; meta: ListResponseMeta } {
  return {
    data: items,
    meta: {
      limit,
      offset,
      hasMore: total !== undefined ? offset + limit < total : items.length === limit,
      total,
      sortBy,
      sortOrder,
    },
  };
}
