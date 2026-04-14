import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import {
  createTestPatient,
  createTestProvider,
  type TestUser,
  type TestProvider,
} from '../helpers/factories';
import { closeTestPool, truncateAllTables, clearStubs } from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { providersRouter } from '../../src/routes/providers';
import { reportsRouter } from '../../src/routes/reports';
import { patientsRouter } from '../../src/routes/patients';
import { patientProviderLinks } from '../../src/db/schema';

/**
 * Integration tests for the v1.1 provider portal additions:
 *   - clinical_notes (provider-private)
 *   - report_requests (provider → patient nudge)
 *   - on-behalf-of report authorship
 *   - dashboard summary aggregator
 *   - patient data export
 */
describe('Provider portal v1.1 additions', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let provider: TestProvider;
  let otherProvider: TestProvider;
  let patient: TestUser;
  let unlinkedPatient: TestUser;
  let auth: string;

  async function link(providerId: string, patientId: string) {
    await container.db.insert(patientProviderLinks).values({
      provider_id: providerId,
      patient_id: patientId,
    });
  }

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({
      '/providers': providersRouter,
      '/reports': reportsRouter,
      '/patients': patientsRouter,
    }));
    provider = await createTestProvider(container.db, { email: 'doc@test.com' });
    otherProvider = await createTestProvider(container.db, { email: 'other@test.com' });
    patient = await createTestPatient(container.db, { email: 'patient@test.com' });
    unlinkedPatient = await createTestPatient(container.db, { email: 'stranger@test.com' });
    auth = bearerFor(provider);
    await link(provider.id, patient.id);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── Clinical notes ────────────────────────────────────────────────────────

  describe('Clinical notes', () => {
    it('creates, lists, updates, and deletes a note', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/notes`)
        .set('Authorization', auth)
        .send({ body: 'Discussed TMD pacing strategy.', tags: ['plan', 'pacing'] });
      expect(create.status).toBe(201);
      const noteId = create.body.data.id;

      const list = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/notes`)
        .set('Authorization', auth);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].body).toBe('Discussed TMD pacing strategy.');

      const update = await request(app)
        .patch(`${API_PREFIX}/providers/notes/${noteId}`)
        .set('Authorization', auth)
        .send({ body: 'Updated body.' });
      expect(update.status).toBe(200);
      expect(update.body.data.body).toBe('Updated body.');

      const del = await request(app)
        .delete(`${API_PREFIX}/providers/notes/${noteId}`)
        .set('Authorization', auth);
      expect(del.status).toBe(204);
    });

    it('refuses to list notes for an unlinked patient', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${unlinkedPatient.id}/notes`)
        .set('Authorization', auth);
      expect(res.status).toBe(403);
    });

    it('another provider cannot read/update/delete notes on the same patient', async () => {
      // provider creates a note.
      const create = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/notes`)
        .set('Authorization', auth)
        .send({ body: 'Private observation.' });
      const noteId = create.body.data.id;

      // otherProvider also links to the patient — but should NOT see provider's notes.
      await link(otherProvider.id, patient.id);
      const otherAuth = bearerFor(otherProvider);

      const list = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/notes`)
        .set('Authorization', otherAuth);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(0);

      const update = await request(app)
        .patch(`${API_PREFIX}/providers/notes/${noteId}`)
        .set('Authorization', otherAuth)
        .send({ body: 'hack' });
      expect(update.status).toBe(404);

      const del = await request(app)
        .delete(`${API_PREFIX}/providers/notes/${noteId}`)
        .set('Authorization', otherAuth);
      expect(del.status).toBe(404);
    });
  });

  // ─── Report requests ───────────────────────────────────────────────────────

  describe('Report requests', () => {
    it('provider creates a request, patient sees it via /reports/requests', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/report-requests`)
        .set('Authorization', auth)
        .send({ prompt: 'Please file an update on pain this week.' });
      expect(create.status).toBe(201);

      const patientAuth = bearerFor(patient);
      const list = await request(app)
        .get(`${API_PREFIX}/reports/requests`)
        .set('Authorization', patientAuth);
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].prompt).toContain('pain this week');
    });

    it('refuses request creation for unlinked patient', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/providers/patients/${unlinkedPatient.id}/report-requests`)
        .set('Authorization', auth)
        .send({ prompt: 'hey' });
      expect(res.status).toBe(403);
    });

    it('another patient cannot dismiss a request meant for someone else', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/report-requests`)
        .set('Authorization', auth)
        .send({ prompt: 'update please' });
      const requestId = create.body.data.id;

      const stranger = bearerFor(unlinkedPatient);
      const dismiss = await request(app)
        .delete(`${API_PREFIX}/reports/requests/${requestId}`)
        .set('Authorization', stranger);
      expect(dismiss.status).toBe(403);
    });

    it('the target patient can dismiss their own pending request', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/report-requests`)
        .set('Authorization', auth)
        .send({ prompt: 'update please' });
      const requestId = create.body.data.id;

      const patientAuth = bearerFor(patient);
      const dismiss = await request(app)
        .delete(`${API_PREFIX}/reports/requests/${requestId}`)
        .set('Authorization', patientAuth);
      expect(dismiss.status).toBe(204);

      // Dismissing again returns 409 (already dismissed).
      const second = await request(app)
        .delete(`${API_PREFIX}/reports/requests/${requestId}`)
        .set('Authorization', patientAuth);
      expect(second.status).toBe(409);
    });
  });

  // ─── On-behalf-of authorship ───────────────────────────────────────────────

  describe('Provider on-behalf-of reports', () => {
    it('stamps authored_by_role=provider and fulfills the linked request', async () => {
      const req1 = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/report-requests`)
        .set('Authorization', auth)
        .send({ prompt: 'Please report pain.' });
      const requestId = req1.body.data.id;

      const filed = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/reports`)
        .set('Authorization', auth)
        .send({
          urgency: 'concerning',
          pain_level: 6,
          description: 'Patient called; pain spiked overnight.',
          fulfilling_request_id: requestId,
        });
      expect(filed.status).toBe(201);
      expect(filed.body.data.authored_by_role).toBe('provider');
      expect(filed.body.data.authored_by_user_id).toBe(provider.id);

      // Request is now fulfilled and linked to this report.
      const patientAuth = bearerFor(patient);
      const list = await request(app)
        .get(`${API_PREFIX}/reports/requests`)
        .set('Authorization', patientAuth);
      // Patient only sees pending; the fulfilled one should be gone.
      expect(list.body.data).toHaveLength(0);
    });

    it('refuses to file for an unlinked patient', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/providers/patients/${unlinkedPatient.id}/reports`)
        .set('Authorization', auth)
        .send({ urgency: 'routine', description: 'x' });
      expect(res.status).toBe(403);
    });

    it('legacy patient submission stamps authored_by_role=patient', async () => {
      const patientAuth = bearerFor(patient);
      const res = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .send({
          provider_id: provider.id,
          urgency: 'routine',
          description: 'Daily check-in.',
        });
      expect(res.status).toBe(201);
      // Re-read via provider inbox (patient GET doesn't echo authored_by fields today).
      const fetch = await request(app)
        .get(`${API_PREFIX}/reports/${res.body.data.id}`)
        .set('Authorization', auth);
      expect(fetch.status).toBe(200);
      expect(fetch.body.data.report.authored_by_role).toBe('patient');
      expect(fetch.body.data.report.authored_by_user_id).toBe(patient.id);
    });
  });

  // ─── Dashboard summary ─────────────────────────────────────────────────────

  describe('GET /providers/dashboard/summary', () => {
    it('returns counts + recent patients + urgent inbox in one call', async () => {
      // Seed an urgent report.
      await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', bearerFor(patient))
        .send({
          provider_id: provider.id,
          urgency: 'urgent',
          description: 'Severe acute pain.',
        });

      const res = await request(app)
        .get(`${API_PREFIX}/providers/dashboard/summary`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.activePatients).toBe(1);
      expect(res.body.data.unreadReports).toBe(1);
      expect(res.body.data.urgentReports).toBe(1);
      expect(res.body.data.recentPatients).toHaveLength(1);
      expect(res.body.data.urgentInbox).toHaveLength(1);
      expect(res.body.data.urgentInbox[0].patient_first_name).toBeTruthy();
    });
  });

  // ─── Patient export ────────────────────────────────────────────────────────

  describe('GET /patients/me/export', () => {
    it('bundles the patient\'s PHI and excludes provider-private records', async () => {
      // Patient files a report, provider adds a clinical note + responds with internal_notes.
      const patientAuth = bearerFor(patient);
      const report = await request(app)
        .post(`${API_PREFIX}/reports`)
        .set('Authorization', patientAuth)
        .send({ provider_id: provider.id, urgency: 'routine', description: 'Check-in.' });

      await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/notes`)
        .set('Authorization', auth)
        .send({ body: 'Private: watch for clenching.' });

      await request(app)
        .post(`${API_PREFIX}/reports/${report.body.data.id}/respond`)
        .set('Authorization', auth)
        .send({ message: 'Sounds steady.', internal_notes: 'Do not share this.' });

      const exp = await request(app)
        .get(`${API_PREFIX}/patients/me/export`)
        .set('Authorization', patientAuth);
      expect(exp.status).toBe(200);
      expect(exp.headers['content-disposition']).toMatch(/tmjconnect-export-/);

      const body = exp.body.data;
      expect(body.account.id).toBe(patient.id);
      expect(body.reports).toHaveLength(1);
      expect(body.report_responses).toHaveLength(1);
      expect(body.report_responses[0].message).toBe('Sounds steady.');
      // Internal notes MUST NOT leak to the patient.
      expect(body.report_responses[0].internal_notes).toBeUndefined();
      // Clinical notes are a separate, excluded surface.
      expect((body as Record<string, unknown>).clinical_notes).toBeUndefined();
    });
  });
});
