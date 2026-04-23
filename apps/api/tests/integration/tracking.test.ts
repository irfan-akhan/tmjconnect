import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { createTestPatient } from '../helpers/factories';
import { truncateAllTables, closeTestPool, clearStubs } from '../helpers/testContainer';
import { trackingRouter } from '../../src/routes/tracking';

const { app, container } = buildTestApp({ '/tracking': trackingRouter });

beforeEach(async () => { await truncateAllTables(); clearStubs(); });
afterAll(async () => { await closeTestPool(); });

describe('Tracking Routes', () => {
  // ─── Jaw Mobility ────────────────────────────────────────────────
  describe('POST /tracking/mobility', () => {
    it('logs a jaw mobility measurement', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(patient))
        .send({ measurement_mm: 30, method: 'fingers' });
      expect(res.status).toBe(201);
      expect(res.body.data.measurement_mm).toBe(30);
    });

    it('rejects measurement out of range', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(patient))
        .send({ measurement_mm: 100 });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /tracking/mobility', () => {
    it('lists mobility logs for the authenticated patient', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(patient))
        .send({ measurement_mm: 25 });

      const res = await request(app)
        .get('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('does not leak another patient\'s data', async () => {
      const p1 = await createTestPatient(container.db);
      const p2 = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(p1))
        .send({ measurement_mm: 35 });

      const res = await request(app)
        .get('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(p2));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('GET /tracking/mobility/trend', () => {
    it('returns trend data', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/tracking/mobility')
        .set('Authorization', bearerFor(patient))
        .send({ measurement_mm: 40 });

      const res = await request(app)
        .get('/api/v1/tracking/mobility/trend?days=60')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].avg_mm).toBe(40);
    });
  });

  // ─── Medications ─────────────────────────────────────────────────
  describe('POST /tracking/medications', () => {
    it('logs a medication dose', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/tracking/medications')
        .set('Authorization', bearerFor(patient))
        .send({ medication_name: 'Ibuprofen', dosage: '400mg' });
      expect(res.status).toBe(201);
      expect(res.body.data.medication_name).toBe('Ibuprofen');
    });
  });

  describe('GET /tracking/medications', () => {
    it('lists medication logs', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/tracking/medications')
        .set('Authorization', bearerFor(patient))
        .send({ medication_name: 'Naproxen' });

      const res = await request(app)
        .get('/api/v1/tracking/medications')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /tracking/medications/correlation', () => {
    it('returns correlation structure', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .get('/api/v1/tracking/medications/correlation?days=30')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('medication_days_avg_pain');
      expect(res.body.data).toHaveProperty('no_medication_days_avg_pain');
    });
  });

  // ─── Sleep ───────────────────────────────────────────────────────
  describe('POST /tracking/sleep', () => {
    it('logs a sleep check-in', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/tracking/sleep')
        .set('Authorization', bearerFor(patient))
        .send({ quality: 4, hours_slept: 7.5, bruxism_aware: false, morning_stiffness: 3 });
      expect(res.status).toBe(201);
      expect(res.body.data.quality).toBe(4);
      expect(res.body.data.bruxism_aware).toBe(false);
    });

    it('rejects quality out of range', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .post('/api/v1/tracking/sleep')
        .set('Authorization', bearerFor(patient))
        .send({ quality: 6 });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /tracking/sleep', () => {
    it('lists sleep logs', async () => {
      const patient = await createTestPatient(container.db);
      await request(app)
        .post('/api/v1/tracking/sleep')
        .set('Authorization', bearerFor(patient))
        .send({ quality: 3 });

      const res = await request(app)
        .get('/api/v1/tracking/sleep')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /tracking/sleep/correlation', () => {
    it('returns correlation structure', async () => {
      const patient = await createTestPatient(container.db);
      const res = await request(app)
        .get('/api/v1/tracking/sleep/correlation?days=30')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
