import type { Container } from '../../config/container';
import { getActiveSessions } from '../../db/queries/patients.queries';
import { parseDevice } from '../../utils/parse-device';
import { lookupLocations } from '../../utils/lookup-location';

type Deps = Pick<Container, 'db'>;

export type ListSessionsInput = { userId: string };

/**
 * Sessions are stored in the role-agnostic `sessions` table — the underlying
 * query is shared with the patient flow.
 */
export async function execute(deps: Deps, input: ListSessionsInput) {
  const rows = await getActiveSessions(deps.db, input.userId);

  const locations = await lookupLocations(
    rows.map((r) => (r.ip_address ? String(r.ip_address) : null)),
  );

  return rows.map((r) => {
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
}
