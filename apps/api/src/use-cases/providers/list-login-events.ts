import type { Container } from '../../config/container';
import { listLoginEvents } from '../../db/queries/admin.queries';
import { parseDevice } from '../../utils/parse-device';
import { lookupLocations } from '../../utils/lookup-location';

type Deps = Pick<Container, 'db'>;

export type ListLoginEventsInput = {
  userId: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'success';
  sortOrder?: 'asc' | 'desc';
};

export async function execute(deps: Deps, input: ListLoginEventsInput) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const sortBy = input.sortBy ?? 'created_at';
  const sortOrder = input.sortOrder ?? 'desc';

  const rows = await listLoginEvents(deps.db, limit + 1, offset, { user_id: input.userId }, sortBy, sortOrder);
  const visible = rows.slice(0, limit);

  const locations = await lookupLocations(
    visible.map((row) => (row.ip_address ? String(row.ip_address) : null)),
  );

  const items = visible.map((row) => {
    const ip = row.ip_address ? String(row.ip_address) : null;
    return {
      id: String(row.id),
      email: String(row.email),
      success: Boolean(row.success),
      ip_address: ip,
      device_info: parseDevice(row.device_info ? String(row.device_info) : null),
      raw_device_info: row.device_info ? String(row.device_info) : null,
      failure_reason: row.failure_reason ? String(row.failure_reason) : null,
      location: ip ? (locations.get(ip) ?? 'Unknown') : 'Unknown',
      created_at: String(row.created_at),
    };
  });

  return {
    items,
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      sortBy,
      sortOrder,
    },
  };
}