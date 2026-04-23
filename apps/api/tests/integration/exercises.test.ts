import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import { createTestPatient, createTestProvider } from '../helpers/factories';
import { truncateAllTables, closeTestPool, clearStubs } from '../helpers/testContainer';
import { exercisesRouter } from '../../src/routes/exercises';
import { providersRouter } from '../../src/routes/providers';
import { linkingRouter } from '../../src/routes/linking';
import { exercises, exerciseAssignments, linkingCodes, patientProviderLinks } from '../../src/db/schema';
import { sql } from 'drizzle-orm';

const { app, container } = buildTestApp({
  '/exercises': exercisesRouter,
  '/providers': providersRouter,
  '/linking': linkingRouter,
});

beforeEach(async () => { await truncateAllTables(); clearStubs(); });
afterAll(async () => { await closeTestPool(); });

async function setupLinkedPatientWithExercise(db: typeof container.db) {
  const provider = await createTestProvider(db);
  const patient = await createTestPatient(db);

  await db.insert(patientProviderLinks).values({
    patient_id: patient.id,
    provider_id: provider.id,
  });

  const [ex] = await db.insert(exercises).values({
    provider_id: provider.id,
    title: 'Jaw Stretch',
    description: 'Gentle opening exercise',
    duration_seconds: 120,
    category: 'stretching',
    instructions: '1. Open mouth slowly\n2. Hold 5 seconds\n3. Close',
  }).returning();

  const [assignment] = await db.insert(exerciseAssignments).values({
    exercise_id: ex.id,
    patient_id: patient.id,
    provider_id: provider.id,
    frequency: 'daily',
    sets: 3,
    status: 'active',
  }).returning();

  return { provider, patient, exercise: ex, assignment };
}

describe('Exercise Routes', () => {
  describe('GET /exercises/assignments', () => {
    it('returns active assignments for the patient', async () => {
      const { patient } = await setupLinkedPatientWithExercise(container.db);
      const res = await request(app)
        .get('/api/v1/exercises/assignments')
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Jaw Stretch');
      expect(res.body.data[0].completed_today).toBe(false);
    });

    it('does not return another patient\'s assignments', async () => {
      await setupLinkedPatientWithExercise(container.db);
      const otherPatient = await createTestPatient(container.db);
      const res = await request(app)
        .get('/api/v1/exercises/assignments')
        .set('Authorization', bearerFor(otherPatient));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('POST /exercises/assignments/:id/complete', () => {
    it('marks an assignment complete for today', async () => {
      const { patient, assignment } = await setupLinkedPatientWithExercise(container.db);
      const res = await request(app)
        .post(`/api/v1/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', bearerFor(patient))
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.alreadyCompleted).toBe(false);
    });

    it('is idempotent — second completion returns alreadyCompleted', async () => {
      const { patient, assignment } = await setupLinkedPatientWithExercise(container.db);
      await request(app)
        .post(`/api/v1/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', bearerFor(patient))
        .send({});

      const res = await request(app)
        .post(`/api/v1/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', bearerFor(patient))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.alreadyCompleted).toBe(true);
    });

    it('rejects another patient completing the assignment', async () => {
      const { assignment } = await setupLinkedPatientWithExercise(container.db);
      const otherPatient = await createTestPatient(container.db);
      const res = await request(app)
        .post(`/api/v1/exercises/assignments/${assignment.id}/complete`)
        .set('Authorization', bearerFor(otherPatient))
        .send({});
      expect(res.status).toBe(404);
    });
  });
});
