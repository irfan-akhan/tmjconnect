import type { Container } from '../../config/container';
import { getAuditLogsForExport } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type ExportAuditLogsInput = { from: string; to: string };

export async function execute(deps: Deps, input: ExportAuditLogsInput) {
  return getAuditLogsForExport(deps.db, input.from, input.to);
}
