import type { Container } from '../../config/container';
import { listSymptomLogs } from '../../db/queries/symptoms.queries';

type Deps = Pick<Container, 'db'>;

export type ListLogsInput = { userId: string; cursor: Date | null; limit: number };
export type ListLogsOutput = { items: Awaited<ReturnType<typeof listSymptomLogs>>; hasMore: boolean };

export async function execute(deps: Deps, input: ListLogsInput): Promise<ListLogsOutput> {
  const rows = await listSymptomLogs(deps.db, input.userId, input.cursor, input.limit);
  return { items: rows.slice(0, input.limit), hasMore: rows.length > input.limit };
}
