import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import {
  createTestPatient,
  createTestProvider,
  type TestUser,
  type TestProvider,
} from '../helpers/factories';
import { closeTestPool, truncateAllTables, clearStubs } from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { reportsRouter } from '../../src/routes/reports';
import { reports, patientProviderLinks } from '../../src/db/schema';

describe('Reports Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let patient: TestUser;
  let provider: TestProvider;
  let patientAuth: string;
  let providerAuth: string;

  async function linkPatient(p: string, pr: string) {
    await container.db.insert(patientProviderLinks).values({ patient_id: p, provider_id: pr });
  }

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({ '/reports': reportsRouter }));
    patient = await createTestPatient(container.db, { email: 'p@test.com' });
    provider = await createTestProvider(container.db, { email: 'pr@test.com' });
    patientAuth = bearerFor(patient);
    providerAuth = bearerFor(provider);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── Submission ──────────────────────────────────────────────────────────────

  describe('POST /reports', () => {
    it('rejects providers (patient-only endpoint)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', providerAuth)
        .send({
          provider_id: provider.id,
          urgency: 'routine',
          description: 'foo',
        });
      expect(res.status).toBe(403);
    });

    it('submits a new report (201)', async () => {
      await linkPatient(patient.id, provider.id);
      const res = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .send({
          provider_id: provider.id,
          urgency: 'concerning',
          pain_level: 6,
          description: 'Pain has increased over the last week',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.urgency).toBe('concerning');
    });

    it('is idempotent on Idempotency-Key replay', async () => {
      await linkPatient(patient.id, provider.id);
      const key = 'idemp-test-key-12345';
      const payload = {
        provider_id: provider.id,
        urgency: 'routine',
        description: 'Identical body',
      };
      const first = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .set('Idempotency-Key', key)
        .send(payload);
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .set('Idempotency-Key', key)
        .send(payload);
      expect(second.status).toBe(200);
      // The replay returns the cached response_body ({status, resourceId}) — not a fresh report.
      expect(second.body.data.resourceId).toBe(first.body.data.id);

      const all = await container.db.select().from(reports).where(eq(reports.patient_id, patient.id));
      expect(all.length).toBe(1);
    });

    it('rejects validation errors (missing description)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .send({ provider_id: provider.id, urgency: 'routine' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Provider inbox ───────────────────────────────────────────────────────────

  describe('GET /reports/inbox', () => {
    async function seedReport(urgency: 'routine' | 'concerning' | 'urgent', forProvider = provider.id) {
      const [row] = await container.db
        .insert(reports)
        .values({
          patient_id: patient.id,
          provider_id: forProvider,
          urgency,
          description: `${urgency} report`,
          status: 'submitted',
        })
        .returning({ id: reports.id });
      return row.id;
    }

    it('rejects patients', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/reports/inbox`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(403);
    });

    it('lists reports sorted by urgency then date', async () => {
      await seedReport('routine');
      await seedReport('urgent');
      await seedReport('concerning');

      const res = await request(app)
        .get(`${API_PREFIX}/reports/inbox`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0].urgency).toBe('urgent');
      expect(res.body.data[1].urgency).toBe('concerning');
      expect(res.body.data[2].urgency).toBe('routine');
    });

    it('does not show reports from another provider', async () => {
      const otherProvider = await createTestProvider(container.db, { email: 'other-pr@test.com' });
      await seedReport('urgent', otherProvider.id);

      const res = await request(app)
        .get(`${API_PREFIX}/reports/inbox`)
        .set('Authorization', providerAuth);
      expect(res.body.data.length).toBe(0);
    });

    it('filters by urgency query param', async () => {
      await seedReport('routine');
      await seedReport('urgent');
      const res = await request(app)
        .get(`${API_PREFIX}/reports/inbox`)
        .query({ urgency: 'urgent' })
        .set('Authorization', providerAuth);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].urgency).toBe('urgent');
    });
  });

  // ─── Get single report ───────────────────────────────────────────────────────

  describe('GET /reports/:id', () => {
    let reportId: string;

    beforeEach(async () => {
      const [row] = await container.db
        .insert(reports)
        .values({
          patient_id: patient.id,
          provider_id: provider.id,
          urgency: 'routine',
          description: 'desc',
          status: 'submitted',
          patient_notes: 'private patient notes',
        })
        .returning({ id: reports.id });
      reportId = row.id;
    });

    it('returns the report to its owner (patient)', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/reports/${reportId}`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.report.patient_notes).toBe('private patient notes');
    });

    it('does not leak internal_notes to the patient', async () => {
      // Add a response with internal_notes from the provider.
      const respond = await request(app)
        .post(`${API_PREFIX}/reports/${reportId}/respond`)
        .set('Authorization', providerAuth)
        .send({ message: 'see me', internal_notes: 'CONFIDENTIAL — escalate' });
      expect(respond.status).toBe(201);

      const res = await request(app)
        .get(`${API_PREFIX}/reports/${reportId}`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(200);
      const responses = res.body.data.responses as Array<Record<string, unknown>>;
      expect(responses.length).toBe(1);
      // Patient response shape MUST omit internal_notes entirely.
      expect(responses[0]).not.toHaveProperty('internal_notes');
    });

    it('returns 404 to a different patient', async () => {
      const stranger = await createTestPatient(container.db, { email: 'stranger@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/reports/${reportId}`)
        .set('Authorization', bearerFor(stranger));
      expect(res.status).toBe(404);
    });

    it('returns the report to the owning provider and marks it viewed', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/reports/${reportId}`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(200);
      expect(['viewed', 'reviewed', 'responded']).toContain(res.body.data.report.status);
    });

    it('returns 404 to a non-owning provider', async () => {
      const otherProvider = await createTestProvider(container.db, { email: 'other-doc@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/reports/${reportId}`)
        .set('Authorization', bearerFor(otherProvider));
      expect(res.status).toBe(404);
    });
  });

  // ─── Provider actions ────────────────────────────────────────────────────────

  describe('Provider actions', () => {
    let reportId: string;
    beforeEach(async () => {
      const [row] = await container.db
        .insert(reports)
        .values({
          patient_id: patient.id,
          provider_id: provider.id,
          urgency: 'concerning',
          description: 'desc',
          status: 'submitted',
        })
        .returning({ id: reports.id });
      reportId = row.id;
    });

    it('responds to a report (201)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/reports/${reportId}/respond`)
        .set('Authorization', providerAuth)
        .send({ message: 'Schedule a follow-up', internal_notes: 'consider PT' });
      expect(res.status).toBe(201);
      expect(res.body.data.message).toBe('Schedule a follow-up');
    });

    it('reviews a report (204)', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/reports/${reportId}/review`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(204);
    });

    it('toggles flag', async () => {
      const first = await request(app)
        .patch(`${API_PREFIX}/reports/${reportId}/flag`)
        .set('Authorization', providerAuth);
      expect(first.status).toBe(200);
      expect(first.body.data.flagged).toBe(true);

      const second = await request(app)
        .patch(`${API_PREFIX}/reports/${reportId}/flag`)
        .set('Authorization', providerAuth);
      expect(second.body.data.flagged).toBe(false);
    });

    it('rejects patients from provider actions', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/reports/${reportId}/respond`)
        .set('Authorization', patientAuth)
        .send({ message: 'foo' });
      expect(res.status).toBe(403);
    });
  });
});
