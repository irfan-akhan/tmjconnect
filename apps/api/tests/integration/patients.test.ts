import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { createTestPatient, createTestProvider, type TestUser } from '../helpers/factories';
import { closeTestPool, truncateAllTables, clearStubs } from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { patientsRouter } from '../../src/routes/patients';
import { symptomsRouter } from '../../src/routes/symptoms';
import { exercisesRouter } from '../../src/routes/exercises';
import { remindersRouter } from '../../src/routes/reminders';
import { notificationsRouter } from '../../src/routes/notifications';
import {
  exercises,
  exerciseAssignments,
  patientProviderLinks,
  notifications,
  symptomLogs,
} from '../../src/db/schema';

describe('Patient Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let patient: TestUser;
  let auth: string;

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({
      '/patients': patientsRouter,
      '/symptoms': symptomsRouter,
      '/exercises': exercisesRouter,
      '/reminders': remindersRouter,
      '/notifications': notificationsRouter,
    }));
    patient = await createTestPatient(container.db, { email: 'pat@test.com' });
    auth = bearerFor(patient);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── /patients ────────────────────────────────────────────────────────────────

  describe('GET /patients/me', () => {
    it('returns the authenticated patient profile', async () => {
      const res = await request(app).get(`${API_PREFIX}/patients/me`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('pat@test.com');
      expect(res.body.data.first_name).toBe('Test');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`${API_PREFIX}/patients/me`);
      expect(res.status).toBe(401);
    });

    it('rejects providers (wrong role)', async () => {
      const provider = await createTestProvider(container.db);
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /patients/me', () => {
    it('updates patient profile fields', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/patients/me`)
        .set('Authorization', auth)
        .send({ first_name: 'Janet', city: 'Austin' });
      expect(res.status).toBe(200);
      expect(res.body.data.first_name).toBe('Janet');
      expect(res.body.data.city).toBe('Austin');
    });

    it('rejects invalid timezone length', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/patients/me`)
        .set('Authorization', auth)
        .send({ timezone: 'x'.repeat(60) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /patients/me/notification-preferences', () => {
    it('returns default preferences', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/patients/me/notification-preferences`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('PATCH /patients/me/notification-preferences', () => {
    it('updates a preference flag', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/patients/me/notification-preferences`)
        .set('Authorization', auth)
        .send({ exercise_reminders: false });
      expect(res.status).toBe(200);
      expect(res.body.data.exercise_reminders).toBe(false);
    });
  });

  // ─── /symptoms ────────────────────────────────────────────────────────────────

  describe('POST /symptoms', () => {
    it('creates a new symptom log', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/symptoms`)
        .set('Authorization', auth)
        .send({
          pain_level: 6,
          pain_types: ['aching'],
          body_areas: [{ area: 'jaw', side: 'left' }],
          triggers: ['stress'],
          notes: 'Worse in the morning',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.pain_level).toBe(6);
    });

    it('upserts on the same calendar day (returns 200)', async () => {
      await request(app).post(`${API_PREFIX}/symptoms`).set('Authorization', auth).send({ pain_level: 4 });
      const res = await request(app).post(`${API_PREFIX}/symptoms`).set('Authorization', auth).send({ pain_level: 7 });
      expect(res.status).toBe(200);
      expect(res.body.data.pain_level).toBe(7);

      const rows = await container.db.select().from(symptomLogs).where(eq(symptomLogs.patient_id, patient.id));
      expect(rows.length).toBe(1);
    });

    it('rejects logged_at in the future', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const res = await request(app)
        .post(`${API_PREFIX}/symptoms`)
        .set('Authorization', auth)
        .send({ pain_level: 5, logged_at: future });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /symptoms', () => {
    it('lists patient symptom logs (cursor paginated)', async () => {
      await request(app).post(`${API_PREFIX}/symptoms`).set('Authorization', auth).send({ pain_level: 5 });
      const res = await request(app).get(`${API_PREFIX}/symptoms`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.hasMore).toBe(false);
    });

    it('does not return another patient\'s logs', async () => {
      const other = await createTestPatient(container.db, { email: 'other@test.com' });
      await request(app)
        .post(`${API_PREFIX}/symptoms`)
        .set('Authorization', bearerFor(other))
        .send({ pain_level: 9 });

      const res = await request(app).get(`${API_PREFIX}/symptoms`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('GET /symptoms/calendar', () => {
    it('returns calendar aggregation for the requested month', async () => {
      await request(app).post(`${API_PREFIX}/symptoms`).set('Authorization', auth).send({ pain_level: 5 });
      const now = new Date();
      const res = await request(app)
        .get(`${API_PREFIX}/symptoms/calendar`)
        .query({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 })
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── /exercises (patient) ─────────────────────────────────────────────────────

  describe('GET /exercises/assignments', () => {
    it('returns only assignments for the authenticated patient', async () => {
      const provider = await createTestProvider(container.db);
      const [ex] = await container.db
        .insert(exercises)
        .values({ provider_id: provider.id, title: 'Jaw stretch' })
        .returning({ id: exercises.id });
      await container.db.insert(exerciseAssignments).values({
        exercise_id: ex.id,
        patient_id: patient.id,
        provider_id: provider.id,
        frequency: 'daily',
        sets: 2,
      });

      const res = await request(app).get(`${API_PREFIX}/exercises/assignments`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Jaw stretch');
    });

    it('returns empty array when no assignments', async () => {
      const res = await request(app).get(`${API_PREFIX}/exercises/assignments`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /exercises/assignments/:id/complete', () => {
    it('marks an assignment complete (201) then idempotent same day (200)', async () => {
      const provider = await createTestProvider(container.db);
      const [ex] = await container.db
        .insert(exercises)
        .values({ provider_id: provider.id, title: 'Jaw stretch' })
        .returning({ id: exercises.id });
      const [assignment] = await container.db
        .insert(exerciseAssignments)
        .values({
          exercise_id: ex.id,
          patient_id: patient.id,
          provider_id: provider.id,
          frequency: 'daily',
          sets: 2,
        })
        .returning({ id: exerciseAssignments.id });

      const first = await request(app)
        .post(`${API_PREFIX}/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', auth);
      expect(first.status).toBe(201);
      expect(first.body.alreadyCompleted).toBe(false);

      const second = await request(app)
        .post(`${API_PREFIX}/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', auth);
      expect(second.status).toBe(200);
      expect(second.body.alreadyCompleted).toBe(true);
    });

    it('rejects completion of an assignment not owned by the patient', async () => {
      const provider = await createTestProvider(container.db);
      const otherPatient = await createTestPatient(container.db, { email: 'op@test.com' });
      const [ex] = await container.db
        .insert(exercises)
        .values({ provider_id: provider.id, title: 'Other ex' })
        .returning({ id: exercises.id });
      const [assignment] = await container.db
        .insert(exerciseAssignments)
        .values({
          exercise_id: ex.id,
          patient_id: otherPatient.id,
          provider_id: provider.id,
        })
        .returning({ id: exerciseAssignments.id });

      const res = await request(app)
        .post(`${API_PREFIX}/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', auth);
      expect(res.status).toBe(404);
    });
  });

  // ─── /reminders ───────────────────────────────────────────────────────────────

  describe('Reminders CRUD', () => {
    it('creates, lists, updates, and deletes a reminder', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/reminders`)
        .set('Authorization', auth)
        .send({ type: 'exercise', time: '08:00', days: ['mon', 'wed', 'fri'] });
      expect(create.status).toBe(201);
      const reminderId = create.body.data.id;

      const list = await request(app).get(`${API_PREFIX}/reminders`).set('Authorization', auth);
      expect(list.status).toBe(200);
      expect(list.body.data.length).toBe(1);

      const update = await request(app)
        .patch(`${API_PREFIX}/reminders/${reminderId}`)
        .set('Authorization', auth)
        .send({ enabled: false });
      expect(update.status).toBe(200);
      expect(update.body.data.enabled).toBe(false);

      const del = await request(app)
        .delete(`${API_PREFIX}/reminders/${reminderId}`)
        .set('Authorization', auth);
      expect(del.status).toBe(204);

      const after = await request(app).get(`${API_PREFIX}/reminders`).set('Authorization', auth);
      expect(after.body.data.length).toBe(0);
    });

    it('rejects malformed time format', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/reminders`)
        .set('Authorization', auth)
        .send({ type: 'symptom', time: '8AM', days: ['mon'] });
      expect(res.status).toBe(400);
    });

    it('does not allow updating another patient\'s reminder', async () => {
      const other = await createTestPatient(container.db, { email: 'other2@test.com' });
      const create = await request(app)
        .post(`${API_PREFIX}/reminders`)
        .set('Authorization', bearerFor(other))
        .send({ type: 'exercise', time: '09:00', days: ['tue'] });
      const otherReminderId = create.body.data.id;

      const res = await request(app)
        .patch(`${API_PREFIX}/reminders/${otherReminderId}`)
        .set('Authorization', auth)
        .send({ enabled: false });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── /notifications ───────────────────────────────────────────────────────────

  describe('Notifications', () => {
    async function seedNotification(unread = true) {
      const [row] = await container.db
        .insert(notifications)
        .values({
          user_id: patient.id,
          type: 'system',
          title: 'Welcome',
          body: 'Hello there',
          ...(unread ? {} : { read_at: new Date() }),
        })
        .returning({ id: notifications.id });
      return row.id;
    }

    it('lists notifications with unread count', async () => {
      await seedNotification();
      await seedNotification();
      const res = await request(app).get(`${API_PREFIX}/notifications`).set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.unread_count).toBe(2);
    });

    it('marks a single notification read', async () => {
      const id = await seedNotification();
      const res = await request(app)
        .patch(`${API_PREFIX}/notifications/${id}/read`)
        .set('Authorization', auth);
      expect(res.status).toBe(200);
      expect(res.body.data.read_at).toBeTruthy();
    });

    it('marks all notifications read', async () => {
      await seedNotification();
      await seedNotification();
      const res = await request(app)
        .patch(`${API_PREFIX}/notifications/read-all`)
        .set('Authorization', auth);
      expect(res.status).toBe(204);

      const after = await request(app).get(`${API_PREFIX}/notifications`).set('Authorization', auth);
      expect(after.body.unread_count).toBe(0);
    });

    it('does not return another user\'s notifications', async () => {
      const other = await createTestPatient(container.db, { email: 'noti@test.com' });
      await container.db.insert(notifications).values({
        user_id: other.id,
        type: 'system',
        title: 'Other',
        body: 'Hi',
      });
      const res = await request(app).get(`${API_PREFIX}/notifications`).set('Authorization', auth);
      expect(res.body.data.length).toBe(0);
    });
  });

  // Avoid unused-import warning when patientProviderLinks is referenced for type-only contexts.
  void patientProviderLinks;
});
