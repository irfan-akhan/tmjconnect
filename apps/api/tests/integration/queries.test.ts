import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import { eq, and, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  createTestContainer,
  truncateAllTables,
  closeTestPool,
} from '../helpers/testContainer';
import { createTestPatient, createTestProvider } from '../helpers/factories';
import {
  symptomLogs,
  patientProviderLinks,
  linkingCodes,
} from '../../src/db/schema';
import { scopeToUser } from '../../src/utils/scopedQuery';
import { upsertSymptomLog } from '../../src/db/queries/symptoms.queries';
import {
  acceptCodeTransaction,
  insertLinkingCode,
  findPendingCode,
} from '../../src/db/queries/linking.queries';

// ─── Test setup ───────────────────────────────────────────────────────────────────

let container: ReturnType<typeof createTestContainer>;

beforeAll(() => {
  container = createTestContainer();
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});

// ─── scopeToUser ─────────────────────────────────────────────────────────────────
//
// Tests verify access control BEHAVIOUR by running actual DB queries.
// A patient must only see their own symptom logs; a provider must see nothing
// via scopeToUser (providers access patient data via verifyProviderLink instead).
// Admin receives all rows.

describe('scopeToUser — access control', () => {
  const baseLogData = {
    pain_level: 5,
    pain_types: ['aching'],
    body_areas: [],
    triggers: [],
    notes: null,
    logged_at: new Date('2026-04-10T10:00:00Z'),
  };

  it('patient sees only their own logs', async () => {
    const { db } = container;
    const patientA = await createTestPatient(db);
    const patientB = await createTestPatient(db);

    // Insert a log for patient A only.
    await upsertSymptomLog(db, patientA.id, baseLogData);

    // Query as patient A.
    const logsA = await db
      .select()
      .from(symptomLogs)
      .where(scopeToUser(undefined, symptomLogs as never, { id: patientA.id, role: 'patient' }));
    expect(logsA).toHaveLength(1);
    expect(logsA[0].patient_id).toBe(patientA.id);

    // Query as patient B — should see nothing.
    const logsB = await db
      .select()
      .from(symptomLogs)
      .where(scopeToUser(undefined, symptomLogs as never, { id: patientB.id, role: 'patient' }));
    expect(logsB).toHaveLength(0);
  });

  it('admin sees all logs regardless of owner', async () => {
    const { db } = container;
    const patientA = await createTestPatient(db);
    const patientB = await createTestPatient(db);

    await upsertSymptomLog(db, patientA.id, baseLogData);
    await upsertSymptomLog(db, patientB.id, {
      ...baseLogData,
      logged_at: new Date('2026-04-09T10:00:00Z'),
    });

    // Admin scope returns sql`TRUE` — no WHERE filter added.
    const allLogs = await db
      .select()
      .from(symptomLogs)
      .where(scopeToUser(undefined, symptomLogs as never, { id: 'any-admin-id', role: 'admin' }));
    expect(allLogs).toHaveLength(2);
  });

  it('combines base condition with scope filter', async () => {
    const { db } = container;
    const patient = await createTestPatient(db);

    // Insert two logs on different days.
    await upsertSymptomLog(db, patient.id, baseLogData);
    await upsertSymptomLog(db, patient.id, {
      ...baseLogData,
      pain_level: 8,
      logged_at: new Date('2026-04-09T10:00:00Z'),
    });

    // Query with a base condition filtering to high pain only.
    const highPain = await db
      .select()
      .from(symptomLogs)
      .where(
        scopeToUser(
          sql`${symptomLogs.pain_level} >= 7`,
          symptomLogs as never,
          { id: patient.id, role: 'patient' },
        ),
      );

    expect(highPain).toHaveLength(1);
    expect(highPain[0].pain_level).toBe(8);
  });
});

// ─── upsertSymptomLog — transaction correctness ───────────────────────────────────
//
// Tests verify the SELECT FOR UPDATE transaction prevents duplicate rows
// when two identical upserts race on the same patient + day.

describe('upsertSymptomLog — transaction', () => {
  const logData = {
    pain_level: 5,
    pain_types: ['aching'],
    body_areas: [],
    triggers: [],
    notes: null,
    logged_at: new Date('2026-04-10T10:00:00Z'),
  };

  it('creates a new row on first upsert', async () => {
    const { db } = container;
    const patient = await createTestPatient(db);

    const { created } = await upsertSymptomLog(db, patient.id, logData);
    expect(created).toBe(true);

    const rows = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.patient_id, patient.id));
    expect(rows).toHaveLength(1);
  });

  it('updates the existing row on a second upsert for the same day', async () => {
    const { db } = container;
    const patient = await createTestPatient(db);

    await upsertSymptomLog(db, patient.id, logData);
    const { created } = await upsertSymptomLog(db, patient.id, {
      ...logData,
      pain_level: 9,
    });

    expect(created).toBe(false);

    const rows = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.patient_id, patient.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].pain_level).toBe(9);
  });

  it('concurrent upserts for the same day produce exactly one row', async () => {
    const { db } = container;
    const patient = await createTestPatient(db);

    // Fire two upserts simultaneously — the FOR UPDATE lock serialises them.
    await Promise.all([
      upsertSymptomLog(db, patient.id, logData),
      upsertSymptomLog(db, patient.id, { ...logData, pain_level: 7 }),
    ]);

    const rows = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.patient_id, patient.id));
    expect(rows).toHaveLength(1);
  });

  it('allows logs on separate days independently', async () => {
    const { db } = container;
    const patient = await createTestPatient(db);

    await upsertSymptomLog(db, patient.id, {
      ...logData,
      logged_at: new Date('2026-04-10T10:00:00Z'),
    });
    await upsertSymptomLog(db, patient.id, {
      ...logData,
      logged_at: new Date('2026-04-09T10:00:00Z'),
    });

    const rows = await db
      .select()
      .from(symptomLogs)
      .where(eq(symptomLogs.patient_id, patient.id));
    expect(rows).toHaveLength(2);
  });
});

// ─── acceptCodeTransaction — duplicate link prevention ────────────────────────────
//
// Tests verify that the TOCTOU fix inside the transaction prevents duplicate
// patient-provider links even when two requests race to accept the same code.

describe('acceptCodeTransaction — duplicate link guard', () => {
  it('creates a link and marks the code as connected', async () => {
    const { db } = container;
    const provider = await createTestProvider(db);
    const patient = await createTestPatient(db);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const codeRow = await insertLinkingCode(db, provider.id, 'ABCD12', expiresAt);

    const link = await acceptCodeTransaction(db, codeRow.id, patient.id, provider.id);
    expect(link).not.toBeNull();
    expect(link!.patient_id).toBe(patient.id);
    expect(link!.provider_id).toBe(provider.id);

    // Code should now be marked 'connected'.
    const [updatedCode] = await db
      .select({ status: linkingCodes.status, patient_id: linkingCodes.patient_id })
      .from(linkingCodes)
      .where(eq(linkingCodes.id, codeRow.id));
    expect(updatedCode.status).toBe('connected');
    expect(updatedCode.patient_id).toBe(patient.id);
  });

  it('returns null when an active link already exists (inside transaction)', async () => {
    const { db } = container;
    const provider = await createTestProvider(db);
    const patient = await createTestPatient(db);

    // Pre-create the active link directly to simulate a race winner.
    await db.insert(patientProviderLinks).values({
      patient_id: patient.id,
      provider_id: provider.id,
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const codeRow = await insertLinkingCode(db, provider.id, 'ABCD13', expiresAt);

    // acceptCodeTransaction should detect the existing link inside the transaction.
    const result = await acceptCodeTransaction(db, codeRow.id, patient.id, provider.id);
    expect(result).toBeNull();

    // Only one link should exist.
    const links = await db
      .select()
      .from(patientProviderLinks)
      .where(
        and(
          eq(patientProviderLinks.patient_id, patient.id),
          eq(patientProviderLinks.provider_id, provider.id),
          isNull(patientProviderLinks.unlinked_at),
        ),
      );
    expect(links).toHaveLength(1);
  });

  it('concurrent accepts produce exactly one link', async () => {
    const { db } = container;
    const provider = await createTestProvider(db);
    const patient = await createTestPatient(db);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const codeRow = await insertLinkingCode(db, provider.id, 'ABCD14', expiresAt);

    // Fire two concurrent transactions — one must see the other's INSERT via FOR UPDATE.
    const results = await Promise.allSettled([
      acceptCodeTransaction(db, codeRow.id, patient.id, provider.id),
      acceptCodeTransaction(db, codeRow.id, patient.id, provider.id),
    ]);

    // At least one must succeed.
    const successes = results.filter(
      (r) => r.status === 'fulfilled' && r.value !== null,
    );
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // Exactly one active link must exist.
    const links = await db
      .select()
      .from(patientProviderLinks)
      .where(
        and(
          eq(patientProviderLinks.patient_id, patient.id),
          eq(patientProviderLinks.provider_id, provider.id),
          isNull(patientProviderLinks.unlinked_at),
        ),
      );
    expect(links).toHaveLength(1);
  });
});
