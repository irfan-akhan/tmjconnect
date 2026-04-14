import { sql } from 'drizzle-orm';
import type { Container } from '../../config/container';

type Deps = Pick<Container, 'db'>;

export type DashboardSummaryInput = { providerId: string };

export type DashboardSummary = {
  activePatients: number;
  unreadReports: number;
  pendingCodes: number;
  urgentReports: number;
  recentPatients: Array<{
    patient_id: string;
    first_name: string;
    last_name: string;
    last_symptom_at: string | null;
  }>;
  urgentInbox: Array<{
    id: string;
    patient_id: string;
    patient_first_name: string;
    patient_last_name: string;
    urgency: 'routine' | 'concerning' | 'urgent';
    status: 'submitted' | 'viewed' | 'reviewed' | 'responded';
    flagged: boolean;
    submitted_at: string;
    description_preview: string | null;
  }>;
};

/**
 * Aggregates counts + the two "what's happening now" lists in one round trip.
 * Each sub-query is parallelised; counts are returned as text and parsed here
 * to avoid Drizzle's bigint-as-string ambiguity.
 */
export async function execute(deps: Deps, input: DashboardSummaryInput): Promise<DashboardSummary> {
  const { db } = deps;
  const { providerId } = input;

  const [activePatients, unreadReports, pendingCodes, urgentReports, recentPatients, urgentInbox] =
    await Promise.all([
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM patient_provider_links
        WHERE provider_id = ${providerId}
          AND unlinked_at IS NULL
      `),
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM reports
        WHERE provider_id = ${providerId}
          AND status = 'submitted'
      `),
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM linking_codes
        WHERE provider_id = ${providerId}
          AND status = 'pending'
          AND expires_at > NOW()
      `),
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total
        FROM reports
        WHERE provider_id = ${providerId}
          AND urgency = 'urgent'
          AND status IN ('submitted', 'viewed')
      `),
      db.execute<{
        patient_id: string;
        first_name: string;
        last_name: string;
        last_symptom_at: string | null;
      }>(sql`
        SELECT
          ppl.patient_id,
          p.first_name,
          p.last_name,
          (
            SELECT MAX(sl.logged_at)::text
            FROM symptom_logs sl
            WHERE sl.patient_id = ppl.patient_id
          ) AS last_symptom_at
        FROM patient_provider_links ppl
        JOIN profiles p ON p.user_id = ppl.patient_id
        WHERE ppl.provider_id = ${providerId}
          AND ppl.unlinked_at IS NULL
        ORDER BY ppl.linked_at DESC
        LIMIT 6
      `),
      db.execute<{
        id: string;
        patient_id: string;
        patient_first_name: string;
        patient_last_name: string;
        urgency: 'routine' | 'concerning' | 'urgent';
        status: 'submitted' | 'viewed' | 'reviewed' | 'responded';
        flagged: boolean;
        submitted_at: string;
        description_preview: string | null;
      }>(sql`
        SELECT
          r.id,
          r.patient_id,
          p.first_name AS patient_first_name,
          p.last_name AS patient_last_name,
          r.urgency,
          r.status,
          r.flagged,
          r.submitted_at::text AS submitted_at,
          LEFT(r.description, 200) AS description_preview
        FROM reports r
        JOIN profiles p ON p.user_id = r.patient_id
        WHERE r.provider_id = ${providerId}
          AND r.urgency = 'urgent'
          AND r.status IN ('submitted', 'viewed')
        ORDER BY r.submitted_at DESC
        LIMIT 5
      `),
    ]);

  function count(r: unknown): number {
    const rows = Array.isArray(r) ? r : (r as { rows?: Array<{ total: string }> }).rows ?? [];
    return parseInt(rows[0]?.total ?? '0', 10);
  }
  function rowsOf<T>(r: unknown): T[] {
    return Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []);
  }

  return {
    activePatients: count(activePatients),
    unreadReports: count(unreadReports),
    pendingCodes: count(pendingCodes),
    urgentReports: count(urgentReports),
    recentPatients: rowsOf<DashboardSummary['recentPatients'][number]>(recentPatients),
    urgentInbox: rowsOf<DashboardSummary['urgentInbox'][number]>(urgentInbox),
  };
}
