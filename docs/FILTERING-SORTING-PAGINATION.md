# API Filtering, Sorting & Pagination Implementation Guide

## Overview

This document outlines the standardized approach for adding filtering, sorting, and pagination to all GET API endpoints. The implementation uses offset-based pagination with optional filtering and sorting support.

## Standard Query Parameters

All list endpoints support these common query parameters:

```
GET /api/v1/resource?limit=10&offset=0&sortBy=created_at&sortOrder=desc&search=query
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 10 | 100 | Items per page |
| `offset` | integer | 0 | N/A | Number of items to skip |
| `sortBy` | string | - | - | Field to sort by (endpoint-specific) |
| `sortOrder` | enum | desc | - | 'asc' or 'desc' |
| `search` | string | - | 255 | Generic search/filter term |

Additional endpoint-specific filters are added as needed.

## Implementation Checklist

For each GET endpoint, follow these steps:

### 1. **Schema Definition** (`packages/shared/src/schemas/*.ts`)

Create or update the query schema to extend `commonListQuerySchema`:

```typescript
import { commonListQuerySchema } from './common.schemas';

export const resourceListQuerySchema = commonListQuerySchema.extend({
  // Add endpoint-specific filters
  status: z.enum(['active', 'inactive']).optional(),
  category: z.string().max(100).optional(),
  // Specify allowed sortBy values
  sortBy: z.enum(['created_at', 'updated_at', 'name']).optional(),
});
```

### 2. **Route Handler** (`apps/api/src/routes/*.ts`)

Update the GET endpoint to parse and use the new parameters:

```typescript
import { resourceListQuerySchema, buildListResponse } from '@tmjconnect/shared';
import { parseListQuery } from '../utils/listHelpers';

router.get(
  '/',
  validate(resourceListQuerySchema, 'query'),
  auditLog('resource_viewed', 'resource'),
  async (req, res, next) => {
    try {
      const { limit, offset, sortBy, sortOrder, search, ...filters } = parseListQuery(req.query);
      const data = await List.execute(container, {
        user: req.user!,
        limit,
        offset,
        sortBy,
        sortOrder,
        search,
        ...filters, // Pass filter-specific params
      });
      res.json(buildListResponse(data, limit, offset));
    } catch (err) { next(err); }
  },
);
```

### 3. **Use Case** (`apps/api/src/use-cases/resource/list.ts`)

Update the use case to accept pagination/filter parameters:

```typescript
export type ListInput = {
  user: ScopedUser;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string; // Endpoint-specific
};

export async function execute(deps: Deps, input: ListInput) {
  return listResources(deps.db, input.user, {
    limit: input.limit,
    offset: input.offset,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
    search: input.search,
    status: input.status,
  });
}
```

### 4. **Query Layer** (`apps/api/src/db/queries/*.ts`)

Update the database query to handle pagination, filtering, and sorting:

```typescript
export async function listResources(
  db: DbClient,
  user: ScopedUser,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    status?: string;
  },
) {
  let whereConditions = [scopeToUser(undefined, resources, user)];

  // Add filters
  if (options?.status) {
    whereConditions.push(eq(resources.status, options.status as any));
  }
  if (options?.search) {
    whereConditions.push(
      or(
        ilike(resources.name, `%${options.search}%`),
        ilike(resources.description, `%${options.search}%`),
      ),
    );
  }

  let query = db
    .select({...})
    .from(resources)
    .where(and(...whereConditions));

  // Add sorting
  if (options?.sortBy === 'name') {
    query = query.orderBy(
      options.sortOrder === 'asc' ? asc(resources.name) : desc(resources.name),
    );
  } else {
    // Default sorting
    query = query.orderBy(desc(resources.created_at));
  }

  // Add pagination
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset !== undefined) {
    query = query.offset(options.offset);
  }

  return query;
}
```

## API Response Format

All list endpoints return responses with metadata:

```json
{
  "data": [...],
  "meta": {
    "limit": 10,
    "offset": 0,
    "hasMore": true,
    "total": 150,
    "sortBy": "created_at",
    "sortOrder": "desc"
  }
}
```

## Endpoints to Update (Priority Order)

### Phase 1: Core Patient Features
- [ ] GET `/exercises/assignments` - DONE
- [ ] GET `/patients/me/sessions`
- [ ] GET `/patients/me/activity`
- [ ] GET `/reminders`
- [ ] GET `/symptoms`

### Phase 2: Clinical Data
- [ ] GET `/reports` (patient inbox)
- [ ] GET `/reports/requests` (requests sent to patient)
- [ ] GET `/intake-forms/assignments/mine`
- [ ] GET `/support/tickets`

### Phase 3: Tracking
- [ ] GET `/tracking/mobility`
- [ ] GET `/tracking/medications`
- [ ] GET `/tracking/sleep`

### Phase 4: Provider Endpoints
- [ ] GET `/providers/exercises` (exercise library)
- [ ] GET `/providers/patients` (patient list)
- [ ] GET `/providers/reports/inbox`
- [ ] GET `/providers/clinic-visits`

### Phase 5: Admin Endpoints
- [ ] GET `/admin/users`
- [ ] GET `/admin/audit-logs`
- [ ] GET `/admin/broadcasts`
- [ ] GET `/admin/outbox`

## Testing Checklist

For each endpoint, test:

- [ ] Default pagination (should return first 10 items)
- [ ] Custom limit and offset
- [ ] Sorting by different fields
- [ ] Filter by status/category/other fields
- [ ] Search functionality
- [ ] `hasMore` flag accuracy
- [ ] Response includes correct metadata

## Examples

### Exercise Assignments
```
GET /api/v1/exercises/assignments?status=active&limit=20&offset=0&sortBy=assigned_at&sortOrder=desc
```

### Reports
```
GET /api/v1/reports?urgency=urgent&limit=10&offset=20&sortBy=created_at&search=knee
```

### Support Tickets
```
GET /api/v1/support/tickets?status=open&limit=15&offset=0&sortBy=created_at&sortOrder=asc
```

## Utilities

### `parseListQuery(query)` - `apps/api/src/utils/listHelpers.ts`
Parses and validates common list query parameters.

### `buildListResponse(items, limit, offset, total, sortBy)`
Builds a standardized response object with metadata.

### `commonListQuerySchema` - `packages/shared/src/schemas/common.schemas.ts`
Base Zod schema for list queries (extend this for endpoint-specific parameters).
