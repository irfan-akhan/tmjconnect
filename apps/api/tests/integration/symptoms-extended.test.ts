import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { createTestPatient } from '../helpers/factories';
import { truncateAllTables, closeTestPool, clearStubs } from '../helpers/testContainer';
import { symptomsRouter } from '../../src/routes/symptoms';

const { app, container } = buildTestApp({ '/symptoms': symptomsRouter });

beforeEach(async () => { await truncateAllTables(); clearStubs(); });
afterAll(async () => { await closeTestPool(); });

describe('Symptoms — Extended', () => {
  describe('GET /symptoms/stats', () => {
    it('returns zero stats for a new patient', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .get('/api/v1/symptoms/stats')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.total_count).toBe(0);
      expect(res.body.data.first_logged_at).toBeNull();
    });
  });

  describe('GET /symptoms/insights', () => {
    it('returns insights with daily averages', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/symptoms')
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 5, pain_types: ['sharp'], triggers: ['stress'] });

      const res = await request(app)
        .get('/api/v1/symptoms/insights?days=7')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.overall.total_logs).toBe(1);
      expect(res.body.data.overall.avg_pain).toBe(5);
      expect(res.body.data.daily_averages.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.trigger_frequency[0].trigger).toBe('stress');
    });

    it('does not leak another patient\'s data', async () => {
      const p1 = await createTestPatient(container.db);
      const p2 = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/symptoms')
        .set('Authorization', bearerFor(p1))
        .send({ pain_level: 8, pain_types: ['throbbing'] });

      const res = await request(app)
        .get('/api/v1/symptoms/insights?days=7')
        .set('Authorization', bearerFor(p2));
      expect(res.status).toBe(200);
      expect(res.body.data.overall.total_logs).toBe(0);
    });
  });

  describe('GET /symptoms/correlation', () => {
    it('returns correlation data', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .get('/api/v1/symptoms/correlation?days=30')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('exercise_days_avg_pain');
      expect(res.body.data).toHaveProperty('no_exercise_days_avg_pain');
    });
  });

  describe('DELETE /symptoms/:id', () => {
    it('deletes a same-day symptom log', async () => {
      const patient = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/symptoms')
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 4 });
      const logId = create.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/symptoms/${logId}`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(204);

      const get = await request(app)
        .get(`/api/v1/symptoms/${logId}`)
        .set('Authorization', bearerFor(patient));
      expect(get.status).toBe(404);
    });

    it('rejects deleting another patient\'s log', async () => {
      const p1 = await createTestPatient(container.db);
      const p2 = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/symptoms')
        .set('Authorization', bearerFor(p1))
        .send({ pain_level: 6 });

      const res = await request(app)
        .delete(`/api/v1/symptoms/${create.body.data.id}`)
        .set('Authorization', bearerFor(p2));
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /symptoms/:id — edit window', () => {
    it('allows editing a same-day log', async () => {
      const patient = await createTestPatient(container.db);
      const create = await request(app)
        .post('/api/v1/symptoms')
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 3 });

      const res = await request(app)
        .patch(`/api/v1/symptoms/${create.body.data.id}`)
        .set('Authorization', bearerFor(patient))
        .send({ pain_level: 7 });
      expect(res.status).toBe(200);
      expect(res.body.data.pain_level).toBe(7);
    });
  });
});
