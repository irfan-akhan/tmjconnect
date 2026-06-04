import type { Container } from '../../config/container';
import { getActiveSessions } from '../../db/queries/patients.queries';
import { parseDevice } from '../../utils/parse-device';
import { lookupLocations } from '../../utils/lookup-location';

type Deps = Pick<Container, 'db'>;

export type ListSessionsInput = {
  userId: string;
  limit?: number;
  offset?: number;
  sortBy?: 'login_at' | 'last_activity';
  sortOrder?: 'asc' | 'desc';
};

export async function execute(deps: Deps, input: ListSessionsInput) {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const sortOrder = input.sortOrder ?? 'desc';
  const rows = await getActiveSessions(deps.db, input.userId, limit, offset, input.sortBy, sortOrder);

  const locations = await lookupLocations(
    rows.map((r) => (r.ip_address ? String(r.ip_address) : null)),
  );

  const items = rows.map((r) => {
    const ip = r.ip_address ? String(r.ip_address) : null;
    return {
      id: r.id,
      device: parseDevice(r.device_info),
      location: ip ? (locations.get(ip) ?? 'Unknown') : 'Unknown',
      ip_address: ip,
      last_active: r.last_active,
      created_at: r.created_at,
    };
  });
  return { items, meta: { limit, offset, hasMore: items.length === limit, sortBy: input.sortBy, sortOrder } };
}
