/**
 * linking.queries.ts — All database interactions for the linking module.
 */
import { eq, and, sql, isNull, desc } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { linkingCodes, patientProviderLinks, profiles } from '../schema';

type DbClient = Db['db'];

// ─── Code generation ─────────────────────────────────────────────────────────────

export async function insertLinkingCode(
  db: DbClient,
  providerId: string,
  code: string,
  expiresAt: Date,
) {
  const [row] = await db
    .insert(linkingCodes)
    .values({ provider_id: providerId, code, expires_at: expiresAt })
    .returning();
  return row;
}

export async function listProviderCodes(db: DbClient, providerId: string) {
  return db
    .select()
    .from(linkingCodes)
    .where(eq(linkingCodes.provider_id, providerId))
    .orderBy(desc(linkingCodes.created_at));
}

// ─── Code acceptance ─────────────────────────────────────────────────────────────

export async function findPendingCode(db: DbClient, code: string) {
  const [row] = await db
    .select()
    .from(linkingCodes)
    .where(and(
      eq(linkingCodes.code, code.toUpperCase()),
      eq(linkingCodes.status, 'pending'),
    ))
    .limit(1);
  return row ?? null;
}

export async function findExistingLink(
  db: DbClient,
  patientId: string,
  providerId: string,
) {
  const [row] = await db
    .select({ id: patientProviderLinks.id })
    .from(patientProviderLinks)
    .where(and(
      eq(patientProviderLinks.patient_id, patientId),
      eq(patientProviderLinks.provider_id, providerId),
      isNull(patientProviderLinks.unlinked_at),
    ))
    .limit(1);
  return row ?? null;
}

/**
 * acceptCodeTransaction — Atomically checks for existing link, updates the code
 * status, and inserts the new link. The duplicate link check is inside the
 * transaction to prevent TOCTOU races from concurrent requests.
 * Returns null if a link already exists (caller should throw CONFLICT).
 */
export async function acceptCodeTransaction(
  db: DbClient,
  codeId: string,
  patientId: string,
  providerId: string,
) {
  return db.transaction(async (tx) => {
    // Lock the code row to serialise concurrent accepts.
    const [code] = await tx
      .select({ id: linkingCodes.id })
      .from(linkingCodes)
      .where(eq(linkingCodes.id, codeId))
      .for('update');
    if (!code) return null;

    // Check for existing active link inside the transaction.
    const [existing] = await tx
      .select({ id: patientProviderLinks.id })
      .from(patientProviderLinks)
      .where(and(
        eq(patientProviderLinks.patient_id, patientId),
        eq(patientProviderLinks.provider_id, providerId),
        isNull(patientProviderLinks.unlinked_at),
      ))
      .limit(1);
    if (existing) return null;

    await tx
      .update(linkingCodes)
      .set({ patient_id: patientId, status: 'connected' })
      .where(eq(linkingCodes.id, codeId));

    const [link] = await tx
      .insert(patientProviderLinks)
      .values({ patient_id: patientId, provider_id: providerId })
      .returning();

    return link;
  });
}

// ─── Disconnect ──────────────────────────────────────────────────────────────────

export async function disconnectLink(
  db: DbClient,
  linkId: string,
  userId: string,
) {
  // Either party (patient or provider) can disconnect.
  const [row] = await db
    .update(patientProviderLinks)
    .set({ unlinked_at: sql`NOW()` })
    .where(and(
      eq(patientProviderLinks.id, linkId),
      isNull(patientProviderLinks.unlinked_at),
      sql`(${patientProviderLinks.patient_id} = ${userId} OR ${patientProviderLinks.provider_id} = ${userId})`,
    ))
    .returning({ id: patientProviderLinks.id });
  return !!row;
}

// ─── Link listing ────────────────────────────────────────────────────────────────

export async function listUserLinks(db: DbClient, userId: string, role: string) {
  if (role === 'provider') {
    return db
      .select({
        link_id: patientProviderLinks.id,
        patient_id: patientProviderLinks.patient_id,
        first_name: profiles.first_name,
        last_name: profiles.last_name,
        linked_at: patientProviderLinks.linked_at,
        consent_scope: patientProviderLinks.consent_scope,
        diagnosis: patientProviderLinks.diagnosis,
      })
      .from(patientProviderLinks)
      .innerJoin(profiles, eq(profiles.user_id, patientProviderLinks.patient_id))
      .where(and(
        eq(patientProviderLinks.provider_id, userId),
        isNull(patientProviderLinks.unlinked_at),
      ))
      .orderBy(desc(patientProviderLinks.linked_at));
  }

  // Patient — show linked providers.
  return db
    .select({
      link_id: patientProviderLinks.id,
      provider_id: patientProviderLinks.provider_id,
      first_name: profiles.first_name,
      last_name: profiles.last_name,
      linked_at: patientProviderLinks.linked_at,
      consent_scope: patientProviderLinks.consent_scope,
    })
    .from(patientProviderLinks)
    .innerJoin(profiles, eq(profiles.user_id, patientProviderLinks.provider_id))
    .where(and(
      eq(patientProviderLinks.patient_id, userId),
      isNull(patientProviderLinks.unlinked_at),
    ))
    .orderBy(desc(patientProviderLinks.linked_at));
}

// ─── Linking metrics (provider portal v2) ────────────────────────────────────────

export type ProviderLinkingMetrics = {
  active_count: number;
  pending_count: number;
  accepted_count: number;
  total_codes: number;
  redemption_pct: number;
  disconnected_30d: number;
  avg_redemption_hours: number | null;
};

export async function getProviderLinkingMetrics(
  db: DbClient,
  providerId: string,
): Promise<ProviderLinkingMetrics> {
  type Row = {
    active_count: string;
    pending_count: string;
    accepted_count: string;
    total_codes: string;
    disconnected_30d: string;
    avg_redemption_hours: string | null;
  };
  const result = await db.execute<Row>(sql`
    SELECT
      (SELECT COUNT(*)::text FROM patient_provider_links
        WHERE provider_id = ${providerId} AND unlinked_at IS NULL) AS active_count,
      (SELECT COUNT(*)::text FROM linking_codes
        WHERE provider_id = ${providerId} AND status = 'pending' AND expires_at > NOW()) AS pending_count,
      (SELECT COUNT(*)::text FROM linking_codes
        WHERE provider_id = ${providerId} AND status = 'connected') AS accepted_count,
      (SELECT COUNT(*)::text FROM linking_codes
        WHERE provider_id = ${providerId}) AS total_codes,
      (SELECT COUNT(*)::text FROM patient_provider_links
        WHERE provider_id = ${providerId} AND unlinked_at IS NOT NULL
          AND unlinked_at >= NOW() - INTERVAL '30 days') AS disconnected_30d,
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ppl.linked_at - lc.created_at)) / 3600)::numeric, 1)::text
        FROM linking_codes lc
        JOIN patient_provider_links ppl
          ON ppl.patient_id = lc.patient_id AND ppl.provider_id = lc.provider_id
        WHERE lc.provider_id = ${providerId}
          AND lc.status = 'connected'
          AND lc.patient_id IS NOT NULL) AS avg_redemption_hours
  `);
  const rows: Row[] = Array.isArray(result) ? result : result.rows ?? [];
  const r = rows[0] ?? {
    active_count: '0',
    pending_count: '0',
    accepted_count: '0',
    total_codes: '0',
    disconnected_30d: '0',
    avg_redemption_hours: null,
  };
  const accepted = parseInt(r.accepted_count, 10);
  const total = parseInt(r.total_codes, 10);
  return {
    active_count: parseInt(r.active_count, 10),
    pending_count: parseInt(r.pending_count, 10),
    accepted_count: accepted,
    total_codes: total,
    redemption_pct: total === 0 ? 0 : Math.round((accepted / total) * 100),
    disconnected_30d: parseInt(r.disconnected_30d, 10),
    avg_redemption_hours:
      r.avg_redemption_hours == null ? null : parseFloat(r.avg_redemption_hours),
  };
}

// ─── Provider name lookup (for notifications) ────────────────────────────────────

export async function getProviderName(db: DbClient, providerId: string) {
  const [row] = await db
    .select({ first_name: profiles.first_name, last_name: profiles.last_name })
    .from(profiles)
    .where(eq(profiles.user_id, providerId))
    .limit(1);
  return row ? `${row.first_name} ${row.last_name}` : null;
}

export async function getPatientName(db: DbClient, patientId: string) {
  const [row] = await db
    .select({ first_name: profiles.first_name, last_name: profiles.last_name })
    .from(profiles)
    .where(eq(profiles.user_id, patientId))
    .limit(1);
  return row ? `${row.first_name} ${row.last_name}` : null;
}
