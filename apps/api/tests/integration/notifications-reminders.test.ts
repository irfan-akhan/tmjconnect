import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { createTestPatient } from '../helpers/factories';
import { truncateAllTables, closeTestPool, clearStubs } from '../helpers/testContainer';
import { notificationsRouter } from '../../src/routes/notifications';
import { remindersRouter } from '../../src/routes/reminders';
import { notifications } from '../../src/db/schema';

const { app, container } = buildTestApp({
  '/notifications': notificationsRouter,
  '/reminders': remindersRouter,
});

beforeEach(async () => { await truncateAllTables(); clearStubs(); });
afterAll(async () => { await closeTestPool(); });

describe('Notification Routes', () => {
  describe('GET /notifications', () => {
    it('returns notifications for the patient', async () => {
      const patient = await createTestPatient(container.db);
      await container.db.insert(notifications).values([
        { user_id: patient.id, type: 'welcome', title: 'Welcome!', body: 'Thanks for joining.' },
        { user_id: patient.id, type: 'exercise_reminder', title: 'Time to stretch', body: 'Daily exercise.' },
      ]);

      const res = await request(app)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('does not return another patient\'s notifications', async () => {
      const p1 = await createTestPatient(container.db);
      const p2 = await createTestPatient(container.db);
      await container.db.insert(notifications).values({
        user_id: p1.id, type: 'welcome', title: 'Hello', body: 'Test',
      });

      const res = await request(app)
        .get('/api/v1/notifications?limit=10')
        .set('Authorization', bearerFor(p2));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks a notification as read', async () => {
      const patient = await createTestPatient(container.db);
      const [n] = await container.db.insert(notifications).values({
        user_id: patient.id, type: 'welcome', title: 'Hi', body: 'Test',
      }).returning();

      const res = await request(app)
        .patch(`/api/v1/notifications/${n.id}/read`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all notifications as read', async () => {
      const patient = await createTestPatient(container.db);
      await container.db.insert(notifications).values([
        { user_id: patient.id, type: 'welcome', title: 'A', body: '1' },
        { user_id: patient.id, type: 'welcome', title: 'B', body: '2' },
      ]);

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', bearerFor(patient));
      expect([200, 204]).toContain(res.status);
    });
  });
});

describe('Reminder Routes', () => {
  describe('POST /reminders', () => {
    it('creates a reminder', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/reminders')
        .set('Authorization', bearerFor(patient))
        .send({ type: 'exercise', time: '09:00', days: ['mon', 'wed', 'fri'] });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe('exercise');
      expect(res.body.data.enabled).toBe(true);
    });
  });

  describe('GET /reminders', () => {
    it('lists reminders for the patient', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/reminders')
        .set('Authorization', bearerFor(patient))
        .send({ type: 'symptom', time: '20:00', days: ['mon', 'tue', 'wed', 'thu', 'fri'] });

      const res = await request(app)
        .get('/api/v1/reminders')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('PATCH /reminders/:id', () => {
    it('updates reminder time and days', async () => {
      const patient = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/reminders')
        .set('Authorization', bearerFor(patient))
        .send({ type: 'exercise', time: '08:00', days: ['mon'] });

      const res = await request(app)
        .patch(`/api/v1/reminders/${create.body.data.id}`)
        .set('Authorization', bearerFor(patient))
        .send({ time: '10:00', days: ['mon', 'wed'], enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.data.time).toMatch(/^10:00/);
      expect(res.body.data.enabled).toBe(false);
    });
  });

  describe('DELETE /reminders/:id', () => {
    it('deletes a reminder', async () => {
      const patient = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/reminders')
        .set('Authorization', bearerFor(patient))
        .send({ type: 'symptom', time: '21:00', days: ['sun'] });

      const res = await request(app)
        .delete(`/api/v1/reminders/${create.body.data.id}`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(204);
    });

    it('rejects deleting another patient\'s reminder', async () => {
      const p1 = await createTestPatient(container.db);
      const p2 = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/reminders')
        .set('Authorization', bearerFor(p1))
        .send({ type: 'exercise', time: '07:00', days: ['tue'] });

      const res = await request(app)
        .delete(`/api/v1/reminders/${create.body.data.id}`)
        .set('Authorization', bearerFor(p2));
      expect(res.status).toBe(404);
    });
  });
});
