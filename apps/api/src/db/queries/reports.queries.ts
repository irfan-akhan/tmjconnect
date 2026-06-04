/**
 * reports.queries.ts — All database interactions for the reports module.
 * internal_notes is NEVER selected in patient-facing queries.
 *
 * Ownership: Drizzle-builder queries use scopeToUser for ownership filtering.
 * Raw-SQL queries (listProviderReports, countProviderReports) hand-write the
 * provider_id filter inline — equivalent protection, just can't share the
 * helper. Queries that accept a reportId without an owner filter
 * (getReportResponses*, markReport*, insertReportResponse) rely on the
 * calling use-case to verify ownership first.
 */
import { eq, sql, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { reports, reportResponses, idempotencyKeys, profiles } from '../schema';
import { scopeToUser, type ScopedUser } from '../../utils/scopedQuery';

type DbClient = Db['db'];

// ─── Idempotency ─────────────────────────────────────────────────────────────────

export async function findIdempotencyKey(db: DbClient, key: string) {
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);
  return row ?? null;
}

export async function insertIdempotencyKey(
  db: DbClient,
  key: string,
  responseStatus: number,
  responseBody: Record<string, unknown>,
) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(idempotencyKeys).values({
    key,
    response_status: responseStatus,
    response_body: responseBody,
    expires_at: expiresAt,
  });
}

// ─── Report submission ───────────────────────────────────────────────────────────

export type ReportInsertData = {
  patient_id: string;
  provider_id: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level?: number | null;
  description: string;
  photo_url?: string | null;
  period_start?: Date | string | null;
  period_end?: Date | string | null;
  summary_data?: Record<string, unknown>;
  patient_notes?: string | null;
  // Provenance (migration 0007). Defaults to patient authorship when omitted —
  // callers building provider-on-behalf-of rows pass these explicitly.
  authored_by_user_id?: string | null;
  authored_by_role?: 'patient' | 'provider';
};

function coerceDate(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

export async function insertReport(db: DbClient, data: ReportInsertData) {
  const [row] = await db
    .insert(reports)
    .values({
      patient_id: data.patient_id,
      provider_id: data.provider_id,
      urgency: data.urgency,
      pain_level: data.pain_level ?? null,
      description: data.description,
      photo_url: data.photo_url ?? null,
      period_start: coerceDate(data.period_start),
      period_end: coerceDate(data.period_end),
      summary_data: data.summary_data ?? {},
      patient_notes: data.patient_notes ?? null,
      authored_by_user_id: data.authored_by_user_id ?? data.patient_id,
      authored_by_role: data.authored_by_role ?? 'patient',
    })
    .returning();
  return row;
}

/**
 * insertReportWithIdempotencyKey — Atomically inserts the report and the
 * idempotency key in a single transaction. Prevents duplicate reports on retry
 * if the process crashes between the two writes.
 */
export async function insertReportWithIdempotencyKey(
  db: DbClient,
  data: ReportInsertData,
  idempotencyKey: string,
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .insert(reports)
      .values({
        patient_id: data.patient_id,
        provider_id: data.provider_id,
        urgency: data.urgency,
        pain_level: data.pain_level ?? null,
        description: data.description,
        photo_url: data.photo_url ?? null,
        period_start: coerceDate(data.period_start),
        period_end: coerceDate(data.period_end),
        summary_data: data.summary_data ?? {},
        patient_notes: data.patient_notes ?? null,
        authored_by_user_id: data.authored_by_user_id ?? data.patient_id,
        authored_by_role: data.authored_by_role ?? 'patient',
      })
      .returning();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await tx.insert(idempotencyKeys).values({
      key: idempotencyKey,
      response_status: 201,
      response_body: { status: 'submitted', resourceId: report.id },
      expires_at: expiresAt,
    });

    return report;
  });
}

// ─── Patient report queries ──────────────────────────────────────────────────────

export async function getReportForPatient(db: DbClient, reportId: string, patient: ScopedUser) {
  const [row] = await db
    .select({
      id: reports.id,
      patient_id: reports.patient_id,
      provider_id: reports.provider_id,
      urgency: reports.urgency,
      pain_level: reports.pain_level,
      description: reports.description,
      photo_url: reports.photo_url,
      period_start: reports.period_start,
      period_end: reports.period_end,
      summary_data: reports.summary_data,
      patient_notes: reports.patient_notes,
      status: reports.status,
      flagged: reports.flagged,
      submitted_at: reports.submitted_at,
      viewed_at: reports.viewed_at,
      reviewed_at: reports.reviewed_at,
    })
    .from(reports)
    .where(scopeToUser(eq(reports.id, reportId), reports, patient))
    .limit(1);
  return row ?? null;
}

export async function getReportResponsesForPatient(db: DbClient, reportId: string) {
  // NEVER select internal_notes for patient-facing queries.
  return db
    .select({
      id: reportResponses.id,
      report_id: reportResponses.report_id,
      provider_id: reportResponses.provider_id,
      message: reportResponses.message,
      responded_at: reportResponses.responded_at,
    })
    .from(reportResponses)
    .where(eq(reportResponses.report_id, reportId))
    .orderBy(reportResponses.responded_at);
}

// ─── Provider report queries ─────────────────────────────────────────────────────

type InboxFilters = {
  status?: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  patient_id?: string;
  from?: string;
  to?: string;
  urgency?: 'routine' | 'concerning' | 'urgent';
};

type InboxRow = {
  id: string;
  patient_id: string;
  urgency: string;
  status: string;
  pain_level: string | null;
  description_preview: string;
  flagged: boolean;
  submitted_at: string;
  patient_first_name: string;
  patient_last_name: string;
};

function buildReportFilters(providerId: string, filters: InboxFilters) {
  return sql`
    r.provider_id = ${providerId}
    ${filters.status ? sql`AND r.status = ${filters.status}` : sql``}
    ${filters.patient_id ? sql`AND r.patient_id = ${filters.patient_id}` : sql``}
    ${filters.from ? sql`AND r.submitted_at >= ${filters.from}::timestamptz` : sql``}
    ${filters.to ? sql`AND r.submitted_at <= ${filters.to}::timestamptz` : sql``}
    ${filters.urgency ? sql`AND r.urgency = ${filters.urgency}` : sql``}
  `;
}

export async function listProviderReports(
  db: DbClient,
  providerId: string,
  page: number,
  limit: number,
  filters: InboxFilters,
) {
  const offset = (page - 1) * limit;
  const where = buildReportFilters(providerId, filters);

  const result = await db.execute<InboxRow>(sql`
    SELECT
      r.id, r.patient_id, r.urgency, r.status,
      r.pain_level::text AS pain_level,
      LEFT(r.description, 200) AS description_preview, r.flagged,
      r.submitted_at::text AS submitted_at,
      p.first_name AS patient_first_name,
      p.last_name AS patient_last_name
    FROM reports r
    JOIN profiles p ON p.user_id = r.patient_id
    WHERE ${where}
    ORDER BY
      CASE r.urgency WHEN 'urgent' THEN 1 WHEN 'concerning' THEN 2 ELSE 3 END,
      r.submitted_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows: InboxRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    ...r,
    pain_level: r.pain_level ? parseInt(r.pain_level, 10) : null,
  }));
}

// ─── Patient's own reports (list + count) ───────────────────────────────────────
type PatientReportFilters = {
  urgency?: 'routine' | 'concerning' | 'urgent';
  from?: string;
  to?: string;
};

type PatientInboxRow = {
  id: string;
  provider_id: string;
  urgency: string;
  status: string;
  pain_level: string | null;
  description_preview: string;
  submitted_at: string;
  provider_first_name: string;
  provider_last_name: string;
  response_count: string;
};

function buildPatientReportFilters(patientId: string, filters: PatientReportFilters) {
  return sql`
    r.patient_id = ${patientId}
    ${filters.urgency ? sql`AND r.urgency = ${filters.urgency}` : sql``}
    ${filters.from ? sql`AND r.submitted_at >= ${filters.from}::timestamptz` : sql``}
    ${filters.to ? sql`AND r.submitted_at <= (${filters.to}::date + INTERVAL '1 day')` : sql``}
  `;
}

export async function listMyReports(
  db: DbClient,
  patientId: string,
  page: number,
  limit: number,
  filters: PatientReportFilters,
) {
  const offset = (page - 1) * limit;
  const where = buildPatientReportFilters(patientId, filters);

  const result = await db.execute<PatientInboxRow>(sql`
    SELECT
      r.id, r.provider_id, r.urgency, r.status,
      r.pain_level::text AS pain_level,
      LEFT(r.description, 200) AS description_preview,
      r.submitted_at::text AS submitted_at,
      p.first_name AS provider_first_name,
      p.last_name AS provider_last_name,
      (SELECT COUNT(*)::text FROM report_responses rr WHERE rr.report_id = r.id) AS response_count
    FROM reports r
    JOIN profiles p ON p.user_id = r.provider_id
    WHERE ${where}
    ORDER BY r.submitted_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const rows: PatientInboxRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return rows.map((r) => ({
    ...r,
    pain_level: r.pain_level ? parseInt(r.pain_level, 10) : null,
    response_count: parseInt(r.response_count, 10),
  }));
}

export async function countMyReports(
  db: DbClient,
  patientId: string,
  filters: PatientReportFilters,
) {
  type CountRow = { total: string };
  const where = buildPatientReportFilters(patientId, filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM reports r WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function countProviderReports(
  db: DbClient,
  providerId: string,
  filters: InboxFilters,
) {
  type CountRow = { total: string };
  const where = buildReportFilters(providerId, filters);
  const result = await db.execute<CountRow>(sql`
    SELECT COUNT(*)::text AS total FROM reports r WHERE ${where}
  `);
  const rows: CountRow[] = Array.isArray(result) ? result : result.rows ?? [];
  return parseInt(rows[0]?.total ?? '0', 10);
}

export async function getReportForProvider(db: DbClient, reportId: string, provider: ScopedUser) {
  const [row] = await db
    .select()
    .from(reports)
    .where(scopeToUser(eq(reports.id, reportId), reports, provider))
    .limit(1);
  return row ?? null;
}

/**
 * Same scope check as getReportForProvider, but joins profiles so the detail
 * view can render the patient's name + initials without a second round-trip.
 * Used by GET /reports/:id only — mutations (review, respond) keep using the
 * lighter getReportForProvider since they don't need profile fields.
 */
export async function getReportWithPatientForProvider(
  db: DbClient,
  reportId: string,
  provider: ScopedUser,
) {
  const [row] = await db
    .select({
      id: reports.id,
      patient_id: reports.patient_id,
      provider_id: reports.provider_id,
      urgency: reports.urgency,
      pain_level: reports.pain_level,
      description: reports.description,
      photo_url: reports.photo_url,
      period_start: reports.period_start,
      period_end: reports.period_end,
      summary_data: reports.summary_data,
      patient_notes: reports.patient_notes,
      status: reports.status,
      flagged: reports.flagged,
      submitted_at: reports.submitted_at,
      viewed_at: reports.viewed_at,
      reviewed_at: reports.reviewed_at,
      patient_first_name: profiles.first_name,
      patient_last_name: profiles.last_name,
      patient_avatar_url: profiles.avatar_url,
    })
    .from(reports)
    .innerJoin(profiles, eq(profiles.user_id, reports.patient_id))
    .where(scopeToUser(eq(reports.id, reportId), reports, provider))
    .limit(1);
  return row ?? null;
}

export async function getReportResponsesForProvider(db: DbClient, reportId: string) {
  // Provider sees internal_notes.
  return db
    .select()
    .from(reportResponses)
    .where(eq(reportResponses.report_id, reportId))
    .orderBy(reportResponses.responded_at);
}

export async function markReportViewed(db: DbClient, reportId: string) {
  await db
    .update(reports)
    .set({ status: 'viewed', viewed_at: sql`NOW()` })
    .where(sql`${reports.id} = ${reportId} AND ${reports.status} = 'submitted'`);
}

/**
 * Bulk-mark every still-submitted report assigned to this provider as viewed.
 * "Mark all read" inbox action — only touches `status = 'submitted'` rows so
 * already-reviewed/responded reports are not regressed. Returns the count of
 * rows actually updated so the UI can show "Marked N reports as read."
 */
export async function markAllReportsViewedForProvider(
  db: DbClient,
  providerId: string,
): Promise<number> {
  const updated = await db
    .update(reports)
    .set({ status: 'viewed', viewed_at: sql`NOW()` })
    .where(sql`${reports.provider_id} = ${providerId} AND ${reports.status} = 'submitted'`)
    .returning({ id: reports.id });
  return updated.length;
}

export async function markReportReviewed(db: DbClient, reportId: string) {
  await db
    .update(reports)
    .set({ status: 'reviewed', reviewed_at: sql`NOW()` })
    .where(eq(reports.id, reportId));
}

export async function insertReportResponse(
  db: DbClient,
  reportId: string,
  providerId: string,
  message: string,
  internalNotes: string | null,
) {
  return db.transaction(async (tx) => {
    const [response] = await tx
      .insert(reportResponses)
      .values({
        report_id: reportId,
        provider_id: providerId,
        message,
        internal_notes: internalNotes,
      })
      .returning();

    await tx
      .update(reports)
      .set({ status: 'responded' })
      .where(eq(reports.id, reportId));

    return response;
  });
}

export async function toggleReportFlag(db: DbClient, reportId: string, provider: ScopedUser) {
  const [row] = await db
    .update(reports)
    .set({ flagged: sql`NOT flagged` })
    .where(scopeToUser(eq(reports.id, reportId), reports, provider))
    .returning({ id: reports.id, flagged: reports.flagged });
  return row ?? null;
}
