import { sql } from 'drizzle-orm';
import type { Container } from '../../config/container';

type Deps = Pick<Container, 'db'>;

export type DashboardSummaryInput = { providerId: string };

export type DashboardSummary = {
  activePatients: number;
  unreadReports: number;
  pendingCodes: number;
  urgentReports: number;
  // Period-over-period deltas for the four KPI tiles. Numbers are signed
  // (positive = grew vs prior 7-day window). null when there is no prior
  // baseline (account too new). Drives the small caret + % on KpiCard.
  deltas: {
    activePatients: { value: number | null; pct: number | null };
    unreadReports: { value: number | null; pct: number | null };
    pendingCodes: { value: number | null; pct: number | null };
    urgentReports: { value: number | null; pct: number | null };
  };
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

  const [activePatients, unreadReports, pendingCodes, urgentReports, deltas, recentPatients, urgentInbox] =
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
      // Single round-trip: prior-7-day baselines for each KPI tile so the UI
      // can render a "+3 vs last week" hint. We compare the trailing 7-day
      // window vs the 7 days before that.
      db.execute<{
        new_links_curr: string;
        new_links_prev: string;
        reports_curr: string;
        reports_prev: string;
        codes_curr: string;
        codes_prev: string;
        urgent_curr: string;
        urgent_prev: string;
      }>(sql`
        SELECT
          (SELECT COUNT(*)::text FROM patient_provider_links
            WHERE provider_id = ${providerId}
              AND linked_at >= NOW() - INTERVAL '7 days') AS new_links_curr,
          (SELECT COUNT(*)::text FROM patient_provider_links
            WHERE provider_id = ${providerId}
              AND linked_at >= NOW() - INTERVAL '14 days'
              AND linked_at <  NOW() - INTERVAL '7 days') AS new_links_prev,
          (SELECT COUNT(*)::text FROM reports
            WHERE provider_id = ${providerId}
              AND submitted_at >= NOW() - INTERVAL '7 days') AS reports_curr,
          (SELECT COUNT(*)::text FROM reports
            WHERE provider_id = ${providerId}
              AND submitted_at >= NOW() - INTERVAL '14 days'
              AND submitted_at <  NOW() - INTERVAL '7 days') AS reports_prev,
          (SELECT COUNT(*)::text FROM linking_codes
            WHERE provider_id = ${providerId}
              AND created_at >= NOW() - INTERVAL '7 days') AS codes_curr,
          (SELECT COUNT(*)::text FROM linking_codes
            WHERE provider_id = ${providerId}
              AND created_at >= NOW() - INTERVAL '14 days'
              AND created_at <  NOW() - INTERVAL '7 days') AS codes_prev,
          (SELECT COUNT(*)::text FROM reports
            WHERE provider_id = ${providerId}
              AND urgency = 'urgent'
              AND submitted_at >= NOW() - INTERVAL '7 days') AS urgent_curr,
          (SELECT COUNT(*)::text FROM reports
            WHERE provider_id = ${providerId}
              AND urgency = 'urgent'
              AND submitted_at >= NOW() - INTERVAL '14 days'
              AND submitted_at <  NOW() - INTERVAL '7 days') AS urgent_prev
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

  type DeltaRow = {
    new_links_curr: string;
    new_links_prev: string;
    reports_curr: string;
    reports_prev: string;
    codes_curr: string;
    codes_prev: string;
    urgent_curr: string;
    urgent_prev: string;
  };
  const deltaRows: DeltaRow[] = Array.isArray(deltas)
    ? (deltas as DeltaRow[])
    : ((deltas as { rows?: DeltaRow[] }).rows ?? []);
  const d = deltaRows[0] ?? {
    new_links_curr: '0', new_links_prev: '0',
    reports_curr: '0', reports_prev: '0',
    codes_curr: '0', codes_prev: '0',
    urgent_curr: '0', urgent_prev: '0',
  };
  function delta(currStr: string, prevStr: string) {
    const curr = parseInt(currStr, 10);
    const prev = parseInt(prevStr, 10);
    const value = curr - prev;
    const pct = prev === 0 ? null : Math.round((value / prev) * 100);
    return { value, pct };
  }

  return {
    activePatients: count(activePatients),
    unreadReports: count(unreadReports),
    pendingCodes: count(pendingCodes),
    urgentReports: count(urgentReports),
    deltas: {
      activePatients: delta(d.new_links_curr, d.new_links_prev),
      unreadReports: delta(d.reports_curr, d.reports_prev),
      pendingCodes: delta(d.codes_curr, d.codes_prev),
      urgentReports: delta(d.urgent_curr, d.urgent_prev),
    },
    recentPatients: rowsOf<DashboardSummary['recentPatients'][number]>(recentPatients),
    urgentInbox: rowsOf<DashboardSummary['urgentInbox'][number]>(urgentInbox),
  };
}
