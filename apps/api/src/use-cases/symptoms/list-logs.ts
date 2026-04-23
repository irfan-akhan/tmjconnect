import type { Container } from '../../config/container';
import { listSymptomLogs } from '../../db/queries/symptoms.queries';
import type { ScopedUser } from '../../utils/scopedQuery';

type Deps = Pick<Container, 'db'>;

export type ListLogsInput = { user: ScopedUser; cursor: Date | null; limit: number };
export type ListLogsOutput = { items: Awaited<ReturnType<typeof listSymptomLogs>>; hasMore: boolean };

export async function execute(deps: Deps, input: ListLogsInput): Promise<ListLogsOutput> {
  const rows = await listSymptomLogs(deps.db, input.user, input.cursor, input.limit);
  return { items: rows.slice(0, input.limit), hasMore: rows.length > input.limit };
}
