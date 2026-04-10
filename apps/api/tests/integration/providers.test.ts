import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { expectAuditEntry } from '../helpers/auditAssertions';
import {
  createTestPatient,
  createTestProvider,
  type TestUser,
  type TestProvider,
} from '../helpers/factories';
import { closeTestPool, truncateAllTables, clearStubs } from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { providersRouter } from '../../src/routes/providers';
import {
  exercises,
  exerciseAssignments,
  patientProviderLinks,
  symptomLogs,
  reports,
  sessions,
} from '../../src/db/schema';

describe('Provider Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let provider: TestProvider;
  let patient: TestUser;
  let auth: string;

  /** Create an active link between provider and patient. */
  async function linkPatient(providerId: string, patientId: string) {
    await container.db.insert(patientProviderLinks).values({
      provider_id: providerId,
      patient_id: patientId,
    });
  }

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({ '/providers': providersRouter }));
    provider = await createTestProvider(container.db, { email: 'doc@test.com' });
    patient = await createTestPatient(container.db, { email: 'patient@test.com' });
    auth = bearerFor(provider);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── Profile ──────────────────────────────────────────────────────────────────

  describe('GET /providers/me', () => {
    it('returns the provider profile', async () => {
      const res = await request(app).get(`${API_PREFIX}/providers/me`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('doc@test.com');
      expect(res.body.data.specialty).toBe('Orofacial Pain');
    });

    it('rejects patients (wrong role)', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/providers/me`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`${API_PREFIX}/providers/me`);
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /providers/me', () => {
    it('updates provider profile fields', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/providers/me`)
        .set('Authorization', auth)
        .send({ specialty: 'Headache & Orofacial Pain', clinic_name: 'New Clinic' });
      expect(res.status).toBe(200);
      expect(res.body.data.specialty).toBe('Headache & Orofacial Pain');
      expect(res.body.data.clinic_name).toBe('New Clinic');
    });
  });

  // ─── Patient list ─────────────────────────────────────────────────────────────

  describe('GET /providers/patients', () => {
    it('returns only linked patients', async () => {
      await linkPatient(provider.id, patient.id);
      const unlinked = await createTestPatient(container.db, { email: 'unlinked@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].patient_id).toBe(patient.id);
      void unlinked;
    });

    it('filters by search query', async () => {
      await linkPatient(provider.id, patient.id);
      const otherPatient = await createTestPatient(container.db, {
        email: 'other@test.com',
        first_name: 'Bob',
        last_name: 'Smith',
      });
      await linkPatient(provider.id, otherPatient.id);

      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients`)
        .query({ search: 'Bob' })
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].patient_id).toBe(otherPatient.id);
    });
  });

  describe('GET /providers/patients/:id', () => {
    it('returns 403 when patient is not linked', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}`)
        .set('Authorization', auth);
      expect(res.status).toBe(403);
    });

    it('returns patient detail when linked', async () => {
      await linkPatient(provider.id, patient.id);
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(patient.id);
    });

    it('writes an audit row whenever a provider views patient detail (HIPAA)', async () => {
      await linkPatient(provider.id, patient.id);
      await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}`)
        .set('Authorization', auth);
      const entry = await expectAuditEntry(container.db, {
        action: 'provider_viewed_patient_detail',
        userId: provider.id,
        resourceType: 'user',
      });
      expect(entry.user_id).toBe(provider.id);
    });

    it('writes an audit row when a provider lists their patients (HIPAA)', async () => {
      await linkPatient(provider.id, patient.id);
      await request(app)
        .get(`${API_PREFIX}/providers/patients`)
        .set('Authorization', auth);
      await expectAuditEntry(container.db, {
        action: 'provider_listed_patients',
        userId: provider.id,
      });
    });
  });

  // ─── Patient symptoms (NEW route) ─────────────────────────────────────────────

  describe('GET /providers/patients/:id/symptoms', () => {
    beforeEach(async () => {
      await container.db.insert(symptomLogs).values({
        patient_id: patient.id,
        pain_level: 7,
        pain_types: ['aching'],
        body_areas: [],
        triggers: [],
        logged_at: new Date(),
      });
    });

    it('returns 403 when patient is not linked', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/symptoms`)
        .set('Authorization', auth);
      expect(res.status).toBe(403);
    });

    it('returns the patient\'s symptom logs when linked (cursor pagination)', async () => {
      await linkPatient(provider.id, patient.id);
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/symptoms`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].pain_level).toBe(7);
      expect(res.body.meta).toBeDefined();
    });

    it('does not allow another provider to view symptoms', async () => {
      await linkPatient(provider.id, patient.id);
      const otherProvider = await createTestProvider(container.db, { email: 'other-doc@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/symptoms`)
        .set('Authorization', bearerFor(otherProvider));
      expect(res.status).toBe(403);
    });
  });

  // ─── Patient reports (NEW route) ──────────────────────────────────────────────

  describe('GET /providers/patients/:id/reports', () => {
    async function seedReport(forPatient: string, urgency: 'routine' | 'concerning' | 'urgent' = 'routine') {
      await container.db.insert(reports).values({
        patient_id: forPatient,
        provider_id: provider.id,
        urgency,
        description: 'Test report',
        status: 'submitted',
      });
    }

    it('returns 403 when patient is not linked', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/reports`)
        .set('Authorization', auth);
      expect(res.status).toBe(403);
    });

    it('returns the patient\'s reports scoped to this provider', async () => {
      await linkPatient(provider.id, patient.id);
      await seedReport(patient.id, 'urgent');
      await seedReport(patient.id, 'routine');

      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/reports`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      // Urgent must sort first.
      expect(res.body.data[0].urgency).toBe('urgent');
      expect(res.body.meta.total).toBe(2);
    });

    it('does not include reports from other patients', async () => {
      await linkPatient(provider.id, patient.id);
      const other = await createTestPatient(container.db, { email: 'noreports@test.com' });
      await linkPatient(provider.id, other.id);
      await seedReport(patient.id);
      await seedReport(other.id);

      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/reports`)
        .set('Authorization', auth);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].patient_id).toBe(patient.id);
    });
  });

  // ─── Sessions (NEW routes) ────────────────────────────────────────────────────

  describe('GET /providers/me/sessions', () => {
    const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('returns the provider\'s active sessions', async () => {
      // createTestProvider inserts a baseline session; this test adds a second.
      await container.db.insert(sessions).values({
        user_id: provider.id,
        device_info: 'Mac Safari',
        ip_address: '127.0.0.1',
        expires_at: futureExpiry(),
      });
      const res = await request(app).get(`${API_PREFIX}/providers/me/sessions`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.some((s: { device_info: string }) => s.device_info === 'Mac Safari')).toBe(true);
    });

    it('does not return another user\'s sessions', async () => {
      await container.db.insert(sessions).values({
        user_id: patient.id,
        device_info: 'iPhone',
        expires_at: futureExpiry(),
      });
      const res = await request(app).get(`${API_PREFIX}/providers/me/sessions`).set('Authorization', auth);
      // The provider's own factory-created session is fine; the patient's iPhone must not appear.
      expect(res.body.data.every((s: { device_info: string }) => s.device_info !== 'iPhone')).toBe(true);
    });
  });

  describe('DELETE /providers/me/sessions/:id', () => {
    const futureExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    it('revokes a session owned by the provider', async () => {
      const [row] = await container.db
        .insert(sessions)
        .values({ user_id: provider.id, device_info: 'Mac', expires_at: futureExpiry() })
        .returning({ id: sessions.id });

      const res = await request(app)
        .delete(`${API_PREFIX}/providers/me/sessions/${row.id}`)
        .set('Authorization', auth);
      expect(res.status).toBe(204);

      const after = await container.db.select().from(sessions).where(eq(sessions.id, row.id));
      expect(after.length).toBe(0);
    });

    it('returns 404 when revoking a session belonging to another user', async () => {
      const [row] = await container.db
        .insert(sessions)
        .values({ user_id: patient.id, device_info: 'iPhone', expires_at: futureExpiry() })
        .returning({ id: sessions.id });
      const res = await request(app)
        .delete(`${API_PREFIX}/providers/me/sessions/${row.id}`)
        .set('Authorization', auth);
      expect(res.status).toBe(404);
    });
  });

  // ─── Exercise library ─────────────────────────────────────────────────────────

  describe('Exercise library CRUD', () => {
    it('creates, lists, updates, and deletes an exercise', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/providers/exercises`)
        .set('Authorization', auth)
        .send({ title: 'Tongue stretch', category: 'mobility', duration_seconds: 60 });
      expect(create.status).toBe(201);
      const exId = create.body.data.id;

      const list = await request(app)
        .get(`${API_PREFIX}/providers/exercises`)
        .set('Authorization', auth);
      expect(list.status).toBe(200);
      expect(list.body.data.length).toBe(1);

      const update = await request(app)
        .patch(`${API_PREFIX}/providers/exercises/${exId}`)
        .set('Authorization', auth)
        .send({ title: 'Renamed' });
      expect(update.status).toBe(200);
      expect(update.body.data.title).toBe('Renamed');

      const del = await request(app)
        .delete(`${API_PREFIX}/providers/exercises/${exId}`)
        .set('Authorization', auth);
      expect(del.status).toBe(204);
    });

    it('does not allow editing another provider\'s exercise', async () => {
      const otherProvider = await createTestProvider(container.db, { email: 'other-doc2@test.com' });
      const [ex] = await container.db
        .insert(exercises)
        .values({ provider_id: otherProvider.id, title: 'Foreign' })
        .returning({ id: exercises.id });

      const res = await request(app)
        .patch(`${API_PREFIX}/providers/exercises/${ex.id}`)
        .set('Authorization', auth)
        .send({ title: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('filters by category', async () => {
      await container.db.insert(exercises).values([
        { provider_id: provider.id, title: 'A', category: 'mobility' },
        { provider_id: provider.id, title: 'B', category: 'strength' },
      ]);

      const res = await request(app)
        .get(`${API_PREFIX}/providers/exercises`)
        .query({ category: 'mobility' })
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('A');
    });
  });

  // ─── Assignments ──────────────────────────────────────────────────────────────

  describe('Patient assignments CRUD', () => {
    let exerciseId: string;

    beforeEach(async () => {
      await linkPatient(provider.id, patient.id);
      const [ex] = await container.db
        .insert(exercises)
        .values({ provider_id: provider.id, title: 'Stretch' })
        .returning({ id: exercises.id });
      exerciseId = ex.id;
    });

    it('creates an assignment for a linked patient', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/providers/patients/${patient.id}/assignments`)
        .set('Authorization', auth)
        .send({
          exercise_id: exerciseId,
          patient_id: patient.id,
          frequency: 'daily',
          sets: 3,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.sets).toBe(3);
    });

    it('rejects assignment for an unlinked patient', async () => {
      const stranger = await createTestPatient(container.db, { email: 'stranger@test.com' });
      const res = await request(app)
        .post(`${API_PREFIX}/providers/patients/${stranger.id}/assignments`)
        .set('Authorization', auth)
        .send({
          exercise_id: exerciseId,
          patient_id: stranger.id,
          frequency: 'daily',
          sets: 1,
        });
      expect([403, 404]).toContain(res.status);
    });

    it('lists assignments for a patient', async () => {
      await container.db.insert(exerciseAssignments).values({
        exercise_id: exerciseId,
        patient_id: patient.id,
        provider_id: provider.id,
      });
      const res = await request(app)
        .get(`${API_PREFIX}/providers/patients/${patient.id}/assignments`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('updates and deletes an assignment', async () => {
      const [a] = await container.db
        .insert(exerciseAssignments)
        .values({
          exercise_id: exerciseId,
          patient_id: patient.id,
          provider_id: provider.id,
        })
        .returning({ id: exerciseAssignments.id });

      const update = await request(app)
        .patch(`${API_PREFIX}/providers/assignments/${a.id}`)
        .set('Authorization', auth)
        .send({ status: 'paused' });
      expect(update.status).toBe(200);
      expect(update.body.data.status).toBe('paused');

      const del = await request(app)
        .delete(`${API_PREFIX}/providers/assignments/${a.id}`)
        .set('Authorization', auth);
      expect(del.status).toBe(204);
    });

    it('does not allow updating another provider\'s assignment', async () => {
      const otherProvider = await createTestProvider(container.db, { email: 'op@test.com' });
      const [a] = await container.db
        .insert(exerciseAssignments)
        .values({
          exercise_id: exerciseId,
          patient_id: patient.id,
          provider_id: otherProvider.id,
        })
        .returning({ id: exerciseAssignments.id });

      const res = await request(app)
        .patch(`${API_PREFIX}/providers/assignments/${a.id}`)
        .set('Authorization', auth)
        .send({ status: 'paused' });
      expect(res.status).toBe(404);
    });
  });
});
