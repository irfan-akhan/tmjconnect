import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { eq, and } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import {
  createTestPatient,
  createTestProvider,
  type TestUser,
  type TestProvider,
} from '../helpers/factories';
import { closeTestPool, truncateAllTables, clearStubs } from '../helpers/testContainer';
import { createTestContainer } from '../helpers/testContainer';
import { API_PREFIX, PROVIDER_SESSION_TIMEOUT_MINUTES } from '../../src/config/constants';
import { patientsRouter } from '../../src/routes/patients';
import { symptomsRouter } from '../../src/routes/symptoms';
import { providersRouter } from '../../src/routes/providers';
import { reportsRouter } from '../../src/routes/reports';
import { authenticate, authorize, checkSessionTimeout } from '../../src/middleware/auth';
import { attachDb } from '../../src/middleware/audit';
import { createErrorHandler } from '../../src/middleware/errorHandler';
import { signAccessToken } from '../../src/utils/jwt';
import {
  auditLogs,
  symptomLogs,
  patientProviderLinks,
  sessions,
  reports,
  reportResponses,
} from '../../src/db/schema';
import { env } from '../../src/config/env';

describe('HIPAA Security Scenarios', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let patient: TestUser;
  let provider: TestProvider;

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({
      '/patients': patientsRouter,
      '/symptoms': symptomsRouter,
      '/providers': providersRouter,
      '/reports': reportsRouter,
    }));
    patient = await createTestPatient(container.db, { email: 'sec-p@test.com' });
    provider = await createTestProvider(container.db, { email: 'sec-pr@test.com' });
  });

  // Track containers from buildSessionApp so their pools can be closed.
  // createTestContainer() returns the singleton testPool, so we dedupe pools
  // and rely on closeTestPool() to actually shut it down — calling .end() on
  // the same pg Pool twice throws "Called end on pool more than once".
  const sessionContainers: ReturnType<typeof createTestContainer>[] = [];

  afterAll(async () => {
    const seen = new Set<unknown>();
    for (const sc of sessionContainers) {
      if (seen.has(sc.pool)) continue;
      seen.add(sc.pool);
      // Skip the singleton testPool — closeTestPool() handles it below.
    }
    await closeTestPool();
  });

  // ─── Authentication boundary ──────────────────────────────────────────────────

  describe('Authentication boundary', () => {
    it('rejects requests without an Authorization header', async () => {
      const res = await request(app).get(`${API_PREFIX}/patients/me`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects requests with a malformed Authorization header', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me`)
        .set('Authorization', 'NotBearer foo');
      expect(res.status).toBe(401);
    });

    it('rejects forged JWTs (signed with wrong secret)', async () => {
      const forged = jwt.sign(
        { id: patient.id, email: patient.email, role: 'patient' },
        'wrong-secret-of-sufficient-length-12345678',
      );
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me`)
        .set('Authorization', `Bearer ${forged}`);
      expect(res.status).toBe(401);
    });

    it('rejects expired JWTs', async () => {
      const expired = jwt.sign(
        { id: patient.id, email: patient.email, role: 'patient' },
        env.JWT_SECRET,
        { expiresIn: '-1m' },
      );
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me`)
        .set('Authorization', `Bearer ${expired}`);
      expect(res.status).toBe(401);
    });

    it('rejects role escalation attempts (patient token forging admin role)', async () => {
      // Even though the token *claims* admin, the user is a patient. Patient routes
      // require role=patient, provider routes require role=provider. An "admin" token
      // forged with the same secret would be valid but role check still gates access.
      const adminClaim = signAccessToken({ id: patient.id, email: patient.email, role: 'admin' });
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me`)
        .set('Authorization', `Bearer ${adminClaim}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── Cross-tenant isolation (PHI scoping) ─────────────────────────────────────

  describe('Cross-tenant data isolation', () => {
    it('one patient cannot read another patient\'s symptom logs', async () => {
      const patientB = await createTestPatient(container.db, { email: 'pb@test.com' });
      // Patient B logs a symptom.
      await container.db.insert(symptomLogs).values({
        patient_id: patientB.id,
        pain_level: 8,
        pain_types: [],
        body_areas: [],
        triggers: [],
        logged_at: new Date(),
      });

      const res = await request(app)
        .get(`${API_PREFIX}/symptoms`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('a provider cannot read symptoms of a non-linked patient', async () => {
      await container.db.insert(symptomLogs).values({
        patient_id: patient.id,
        pain_level: 8,
        pain_types: [],
        body_areas: [],
        triggers: [],
        logged_at: new Date(),
      });
      // No link between patient and provider.
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/symptoms`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(403);
    });

    it('a provider cannot read another provider\'s reports', async () => {
      const otherProvider = await createTestProvider(container.db, { email: 'op@test.com' });
      const [row] = await container.db
        .insert(reports)
        .values({
          patient_id: patient.id,
          provider_id: otherProvider.id,
          urgency: 'urgent',
          description: 'foreign report',
          status: 'submitted',
        })
        .returning({ id: reports.id });

      const res = await request(app)
        .get(`${API_PREFIX}/reports/${row.id}`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(404);
    });
  });

  // ─── PHI redaction in responses ───────────────────────────────────────────────

  describe('PHI redaction', () => {
    it('internal_notes is never present in patient-facing report responses', async () => {
      // Set up a linked pair and a report with a provider response that contains internal_notes.
      await container.db.insert(patientProviderLinks).values({
        patient_id: patient.id,
        provider_id: provider.id,
      });
      const [report] = await container.db
        .insert(reports)
        .values({
          patient_id: patient.id,
          provider_id: provider.id,
          urgency: 'routine',
          description: 'desc',
          status: 'submitted',
        })
        .returning({ id: reports.id });
      await container.db.insert(reportResponses).values({
        report_id: report.id,
        provider_id: provider.id,
        message: 'Public message',
        internal_notes: 'PRIVATE — DO NOT LEAK',
      });

      const res = await request(app)
        .get(`${API_PREFIX}/reports/${report.id}`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('PRIVATE');
      expect(body).not.toContain('internal_notes');
    });
  });

  // ─── Provider session timeout (15 min inactivity) ─────────────────────────────

  describe('Provider session timeout middleware', () => {
    /**
     * checkSessionTimeout is a middleware that, on every authenticated provider
     * request, refreshes last_active OR deletes the session if last_active is
     * older than the timeout. We exercise it directly with a tiny app since it
     * is not currently mounted on any route (it must be wired explicitly per the
     * architecture spec — this test exists so the contract is verified).
     */
    function buildSessionApp() {
      const c = createTestContainer();
      sessionContainers.push(c);
      const a = express();
      a.use(express.json());
      a.use(attachDb(c.db, c.logger));
      a.get(
        '/protected',
        authenticate,
        authorize('provider'),
        checkSessionTimeout(c.db),
        (_req, res) => res.json({ ok: true }),
      );
      a.use(createErrorHandler(c.logger));
      return { app: a, container: c };
    }

    it('passes when the session is fresh', async () => {
      const { app: sa, container: sc } = buildSessionApp();
      await sc.db.insert(sessions).values({
        user_id: provider.id,
        device_info: 'web',
        last_active: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(sa)
        .get('/protected')
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(200);
    });

    it('returns 401 SESSION_TIMEOUT and deletes the session when last_active is too old', async () => {
      const { app: sa, container: sc } = buildSessionApp();
      // Clear the fresh session that createTestProvider inserts so only the stale row remains.
      await sc.db.delete(sessions).where(eq(sessions.user_id, provider.id));
      const stale = new Date(Date.now() - (PROVIDER_SESSION_TIMEOUT_MINUTES + 5) * 60 * 1000);
      await sc.db.insert(sessions).values({
        user_id: provider.id,
        device_info: 'web',
        last_active: stale,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(sa)
        .get('/protected')
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_TIMEOUT');

      const remaining = await sc.db.select().from(sessions).where(eq(sessions.user_id, provider.id));
      expect(remaining.length).toBe(0);
    });
  });

  // ─── Audit logging is fired for sensitive routes ──────────────────────────────

  describe('Audit logging', () => {
    it('writes an audit_logs row when a provider views a linked patient\'s symptoms', async () => {
      await container.db.insert(patientProviderLinks).values({
        patient_id: patient.id,
        provider_id: provider.id,
      });

      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/symptoms`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(200);

      // Audit insert is fire-and-forget on res.on('finish'). Wait briefly for
      // the async insert to land. We poll up to ~500ms total instead of fixed sleep.
      let entry: typeof auditLogs.$inferSelect | undefined;
      for (let i = 0; i < 10; i++) {
        const rows = await container.db
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.user_id, provider.id),
              eq(auditLogs.action, 'provider_viewed_patient_symptoms'),
            ),
          );
        if (rows.length > 0) {
          entry = rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(entry).toBeDefined();
      expect(entry?.resource_type).toBe('symptom_log');
    });

    it('records who deleted what on session revoke', async () => {
      const [s] = await container.db
        .insert(sessions)
        .values({
          user_id: provider.id,
          device_info: 'phone',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning({ id: sessions.id });

      const res = await request(app)
        .delete(`${API_PREFIX}/providers/me/sessions/${s.id}`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(204);

      let entry: typeof auditLogs.$inferSelect | undefined;
      for (let i = 0; i < 10; i++) {
        const rows = await container.db
          .select()
          .from(auditLogs)
          .where(
            and(eq(auditLogs.user_id, provider.id), eq(auditLogs.action, 'session_revoked')),
          );
        if (rows.length > 0) {
          entry = rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(entry).toBeDefined();
    });
  });

  // ─── Symptom edit window (DB trigger) ─────────────────────────────────────────

  describe('Symptom 24h edit window', () => {
    it('allows editing a symptom log within 24h', async () => {
      // Insert a log dated 1 hour ago.
      const [row] = await container.db
        .insert(symptomLogs)
        .values({
          patient_id: patient.id,
          pain_level: 5,
          pain_types: [],
          body_areas: [],
          triggers: [],
          logged_at: new Date(Date.now() - 60 * 60 * 1000),
        })
        .returning({ id: symptomLogs.id });

      const res = await request(app)
        .patch(`${API_PREFIX}/symptoms/${row.id}`)
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 7 });
      expect(res.status).toBe(200);
      expect(res.body.data.pain_level).toBe(7);
    });

    it('blocks editing a symptom log older than 24h (DB trigger)', async () => {
      // The trigger anchors on created_at (server-set, immutable in production).
      // For this test we backdate created_at directly to simulate a 48h-old row.
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const [row] = await container.db
        .insert(symptomLogs)
        .values({
          patient_id: patient.id,
          pain_level: 5,
          pain_types: [],
          body_areas: [],
          triggers: [],
          logged_at: fortyEightHoursAgo,
          created_at: fortyEightHoursAgo,
        })
        .returning({ id: symptomLogs.id });

      const res = await request(app)
        .patch(`${API_PREFIX}/symptoms/${row.id}`)
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 9 });
      // Trigger raises P0001 → CONSTRAINT_VIOLATION (400).
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CONSTRAINT_VIOLATION');
    });
  });
});
