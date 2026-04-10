import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { eq, isNull, and } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import {
  createTestPatient,
  createTestProvider,
  type TestUser,
  type TestProvider,
} from '../helpers/factories';
import {
  closeTestPool,
  truncateAllTables,
  clearStubs,
  sentEmails,
  createdNotifications,
} from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { linkingRouter } from '../../src/routes/linking';
import { linkingCodes, patientProviderLinks } from '../../src/db/schema';

describe('Linking Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let patient: TestUser;
  let provider: TestProvider;
  let patientAuth: string;
  let providerAuth: string;

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({ '/linking': linkingRouter }));
    patient = await createTestPatient(container.db, { email: 'p@test.com' });
    provider = await createTestProvider(container.db, { email: 'pr@test.com' });
    patientAuth = bearerFor(patient);
    providerAuth = bearerFor(provider);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── Code generation ─────────────────────────────────────────────────────────

  describe('POST /linking/codes', () => {
    it('rejects patients', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/linking/codes`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(403);
    });

    it('generates a 6-character code for the provider', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/linking/codes`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(201);
      expect(res.body.data.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(new Date(res.body.data.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('GET /linking/codes', () => {
    it('lists this provider\'s pending codes', async () => {
      await request(app).post(`${API_PREFIX}/linking/codes`).set('Authorization', providerAuth);
      await request(app).post(`${API_PREFIX}/linking/codes`).set('Authorization', providerAuth);

      const res = await request(app)
        .get(`${API_PREFIX}/linking/codes`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('does not show another provider\'s codes', async () => {
      await request(app).post(`${API_PREFIX}/linking/codes`).set('Authorization', providerAuth);
      const otherProvider = await createTestProvider(container.db, { email: 'other-pr@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/linking/codes`)
        .set('Authorization', bearerFor(otherProvider));
      expect(res.body.data.length).toBe(0);
    });
  });

  // ─── Email invite ────────────────────────────────────────────────────────────

  describe('POST /linking/codes/:codeId/invite', () => {
    it('queues an invitation email', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/linking/codes`)
        .set('Authorization', providerAuth);
      const code = create.body.data.code;

      const res = await request(app)
        .post(`${API_PREFIX}/linking/codes/${code}/invite`)
        .set('Authorization', providerAuth)
        .send({ patient_email: 'invitee@test.com', patient_name: 'Inv' });
      expect(res.status).toBe(202);
      expect(sentEmails.some((e) => e.to === 'invitee@test.com' && e.type === 'emailInvite')).toBe(true);
    });
  });

  // ─── Accept code ─────────────────────────────────────────────────────────────

  describe('POST /linking/accept', () => {
    it('rejects providers (patient-only)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/linking/accept`)
        .set('Authorization', providerAuth)
        .send({ code: 'ABCDEF' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for an unknown code', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/linking/accept`)
        .set('Authorization', patientAuth)
        .send({ code: 'NOTREL' });
      expect(res.status).toBe(404);
    });

    it('creates an active link and notifies both parties', async () => {
      const create = await request(app)
        .post(`${API_PREFIX}/linking/codes`)
        .set('Authorization', providerAuth);
      const code = create.body.data.code;

      const res = await request(app)
        .post(`${API_PREFIX}/linking/accept`)
        .set('Authorization', patientAuth)
        .send({ code });
      expect(res.status).toBe(201);

      // Active link row exists.
      const active = await container.db
        .select()
        .from(patientProviderLinks)
        .where(
          and(
            eq(patientProviderLinks.patient_id, patient.id),
            eq(patientProviderLinks.provider_id, provider.id),
            isNull(patientProviderLinks.unlinked_at),
          ),
        );
      expect(active.length).toBe(1);

      // Both notifications were created.
      expect(createdNotifications.length).toBe(2);
    });

    it('rejects a duplicate active link with 409', async () => {
      // Pre-link the pair.
      await container.db.insert(patientProviderLinks).values({
        patient_id: patient.id,
        provider_id: provider.id,
      });
      const create = await request(app)
        .post(`${API_PREFIX}/linking/codes`)
        .set('Authorization', providerAuth);
      const code = create.body.data.code;

      const res = await request(app)
        .post(`${API_PREFIX}/linking/accept`)
        .set('Authorization', patientAuth)
        .send({ code });
      expect(res.status).toBe(409);
    });

    it('rejects an expired code with 410', async () => {
      // Insert a code that already expired.
      const [row] = await container.db
        .insert(linkingCodes)
        .values({
          code: 'EXPIRD',
          provider_id: provider.id,
          expires_at: new Date(Date.now() - 60_000),
        })
        .returning({ code: linkingCodes.code });

      const res = await request(app)
        .post(`${API_PREFIX}/linking/accept`)
        .set('Authorization', patientAuth)
        .send({ code: row.code });
      expect(res.status).toBe(410);
    });
  });

  // ─── List + disconnect links ─────────────────────────────────────────────────

  describe('GET /linking/links', () => {
    beforeEach(async () => {
      await container.db.insert(patientProviderLinks).values({
        patient_id: patient.id,
        provider_id: provider.id,
      });
    });

    it('returns links from the patient perspective', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/linking/links`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('returns links from the provider perspective', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/linking/links`)
        .set('Authorization', providerAuth);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('DELETE /linking/links/:id', () => {
    let linkId: string;
    beforeEach(async () => {
      const [row] = await container.db
        .insert(patientProviderLinks)
        .values({ patient_id: patient.id, provider_id: provider.id })
        .returning({ id: patientProviderLinks.id });
      linkId = row.id;
    });

    it('lets the patient disconnect their own link', async () => {
      const res = await request(app)
        .delete(`${API_PREFIX}/linking/links/${linkId}`)
        .set('Authorization', patientAuth);
      expect(res.status).toBe(204);
    });

    it('lets the provider disconnect their own link', async () => {
      const res = await request(app)
        .delete(`${API_PREFIX}/linking/links/${linkId}`)
        .set('Authorization', providerAuth);
      expect(res.status).toBe(204);
    });

    it('rejects disconnect by an unrelated user', async () => {
      const stranger = await createTestPatient(container.db, { email: 'stranger@test.com' });
      const res = await request(app)
        .delete(`${API_PREFIX}/linking/links/${linkId}`)
        .set('Authorization', bearerFor(stranger));
      expect(res.status).toBe(404);
    });
  });
});
