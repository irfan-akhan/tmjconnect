import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import {
  createTestContainer,
  truncateAllTables,
  closeTestPool,
  clearStubs,
  sentEmails,
} from '../helpers/testContainer';
import { createTestPatient, createTestProvider } from '../helpers/factories';
import express from 'express';
import { authRouter } from '../../src/routes/auth';
import { createErrorHandler } from '../../src/middleware/errorHandler';
import { attachDb } from '../../src/middleware/audit';
import { API_PREFIX } from '../../src/config/constants';

// ─── Test app setup ────────────────────────────────────────────────────────────────

function buildTestApp() {
  const container = createTestContainer();
  const app = express();
  app.use(express.json());
  app.set('trust proxy', 1);
  app.use(attachDb(container.db, container.logger));
  app.use(`${API_PREFIX}/auth`, authRouter(container));
  app.use(createErrorHandler(container.logger));
  return { app, container };
}

async function getVerifyCode(container: ReturnType<typeof createTestContainer>, email: string) {
  const { users: usersTable } = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const { decryptVerifyCode } = await import('../../src/utils/hash');
  const [user] = await container.db
    .select({ code: usersTable.email_verify_code })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (!user?.code) return undefined;
  return decryptVerifyCode(user.code);
}

// ─── Tests ────────────────────────────────────────────────────────────────────────

describe('Auth Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof createTestContainer>;

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    // Rebuild app each test so the rate limiter starts with a fresh in-memory state.
    ({ app, container } = buildTestApp());
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PATIENT REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/patient/register', () => {
    it('registers a patient successfully', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'patient@test.com',
          password: 'Test@1234!',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/check your email/i);
      expect(sentEmails.some((e) => e.to === 'patient@test.com' && e.type === 'verifyEmail')).toBe(true);
    });

    it('rejects duplicate email', async () => {
      await createTestPatient(container.db, { email: 'dup@test.com' });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'dup@test.com',
          password: 'Test@1234!',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('rejects weak password', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'weak@test.com',
          password: 'weakpass',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('does not return tokens after registration', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'notokens@test.com',
          password: 'Test@1234!',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('access_token');
      expect(res.body).not.toHaveProperty('refresh_token');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROVIDER REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/provider/register', () => {
    it('registers a provider with professional fields', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/provider/register`)
        .send({
          email: 'provider@test.com',
          password: 'Test@1234!',
          first_name: 'Dr.',
          last_name: 'Smith',
          license_number: 'TX-001',
          license_type: 'DDS',
          specialty: 'Orofacial Pain',
          clinic_name: 'Pain Clinic',
        });

      expect(res.status).toBe(201);
    });

    it('rejects provider registration without professional fields', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/provider/register`)
        .send({
          email: 'noprof@test.com',
          password: 'Test@1234!',
          first_name: 'Dr.',
          last_name: 'Smith',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/verify-email', () => {
    it('verifies email and issues tokens for a patient', async () => {
      await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'toverify@test.com',
          password: 'Test@1234!',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      const code = await getVerifyCode(container, 'toverify@test.com');

      const res = await request(app)
        .post(`${API_PREFIX}/auth/verify-email`)
        .send({ email: 'toverify@test.com', code });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });

    it('returns mfa_setup_required for provider', async () => {
      await request(app)
        .post(`${API_PREFIX}/auth/provider/register`)
        .send({
          email: 'provverify@test.com',
          password: 'Test@1234!',
          first_name: 'Dr.',
          last_name: 'Smith',
          license_number: 'TX-001',
          license_type: 'DDS',
          specialty: 'Orofacial Pain',
          clinic_name: 'Clinic',
        });

      const code = await getVerifyCode(container, 'provverify@test.com');

      const res = await request(app)
        .post(`${API_PREFIX}/auth/verify-email`)
        .send({ email: 'provverify@test.com', code });

      expect(res.status).toBe(200);
      expect(res.body.mfa_setup_required).toBe(true);
      expect(res.body).toHaveProperty('setup_token');
      expect(res.body).not.toHaveProperty('access_token');
    });

    it('rejects invalid code', async () => {
      await request(app)
        .post(`${API_PREFIX}/auth/patient/register`)
        .send({
          email: 'badcode@test.com',
          password: 'Test@1234!',
          first_name: 'Jane',
          last_name: 'Doe',
        });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/verify-email`)
        .send({ email: 'badcode@test.com', code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CODE');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PATIENT LOGIN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/patient/login', () => {
    it('logs in a patient and returns tokens', async () => {
      await createTestPatient(container.db, { email: 'login@test.com', password: 'Test@1234!' });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: 'login@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
    });

    it('rejects provider trying patient login', async () => {
      await createTestProvider(container.db, { email: 'wrongportal@test.com', mfa_enabled: true });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: 'wrongportal@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WRONG_PORTAL');
    });

    it('rejects wrong password', async () => {
      await createTestPatient(container.db, { email: 'wrongpw@test.com', password: 'Test@1234!' });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: 'wrongpw@test.com', password: 'WrongPass@1' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects login for unverified email', async () => {
      await createTestPatient(container.db, {
        email: 'unverified@test.com',
        password: 'Test@1234!',
        email_verified: false,
      });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: 'unverified@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('VERIFY_EMAIL');
    });

    it('returns generic error for unknown email (no enumeration)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: 'nobody@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PROVIDER LOGIN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/provider/login', () => {
    it('returns mfa_required for a provider with MFA enabled', async () => {
      await createTestProvider(container.db, {
        email: 'prov@test.com',
        password: 'Test@1234!',
        mfa_enabled: true,
      });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/provider/login`)
        .send({ email: 'prov@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(200);
      expect(res.body.mfa_required).toBe(true);
      expect(res.body).toHaveProperty('mfa_token');
      expect(res.body).not.toHaveProperty('access_token');
    });

    it('rejects provider without MFA setup', async () => {
      await createTestProvider(container.db, {
        email: 'nomfaprov@test.com',
        password: 'Test@1234!',
        mfa_enabled: false,
      });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/provider/login`)
        .send({ email: 'nomfaprov@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MFA_NOT_SETUP');
    });

    it('rejects patient trying provider login', async () => {
      await createTestPatient(container.db, { email: 'patient2@test.com' });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/provider/login`)
        .send({ email: 'patient2@test.com', password: 'Test@1234!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WRONG_PORTAL');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PATIENT MFA OPT-IN / OPT-OUT
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Patient optional MFA', () => {
    it('patient login returns mfa_required when MFA is enabled', async () => {
      const patient = await createTestPatient(container.db, {
        email: 'mfaopt@test.com',
        password: 'Test@1234!',
      });
      const { users: usersTable } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await container.db
        .update(usersTable)
        .set({ mfa_enabled: true })
        .where(eq(usersTable.id, patient.id));

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      expect(res.status).toBe(200);
      expect(res.body.mfa_required).toBe(true);
      expect(res.body).toHaveProperty('mfa_token');
    });

    it('POST /auth/patient/mfa/init returns a setup token', async () => {
      const patient = await createTestPatient(container.db, { email: 'init@test.com' });
      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });
      const { access_token } = loginRes.body;

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/mfa/init`)
        .set('Authorization', `Bearer ${access_token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('setup_token');
    });

    it('POST /auth/patient/mfa/init rejects if MFA already enabled', async () => {
      const patient = await createTestPatient(container.db, { email: 'already@test.com' });
      const { users: usersTable } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await container.db
        .update(usersTable)
        .set({ mfa_enabled: true })
        .where(eq(usersTable.id, patient.id));

      const { signAccessToken } = await import('../../src/utils/jwt');
      const access_token = signAccessToken({ id: patient.id, email: patient.email, role: 'patient' });

      const res = await request(app)
        .post(`${API_PREFIX}/auth/patient/mfa/init`)
        .set('Authorization', `Bearer ${access_token}`);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('DELETE /auth/patient/mfa requires correct password and clears MFA', async () => {
      const patient = await createTestPatient(container.db, { email: 'disable@test.com' });
      const { users: usersTable } = await import('../../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await container.db
        .update(usersTable)
        .set({ mfa_enabled: true, mfa_secret: 'fake_encrypted_secret' })
        .where(eq(usersTable.id, patient.id));

      const { signAccessToken } = await import('../../src/utils/jwt');
      const access_token = signAccessToken({ id: patient.id, email: patient.email, role: 'patient' });

      // Wrong password rejected.
      const wrongRes = await request(app)
        .delete(`${API_PREFIX}/auth/patient/mfa`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ password: 'WrongPass@1' });
      expect(wrongRes.status).toBe(401);

      // Correct password accepted.
      const correctRes = await request(app)
        .delete(`${API_PREFIX}/auth/patient/mfa`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ password: patient.password });
      expect(correctRes.status).toBe(200);

      const [user] = await container.db
        .select({ mfa_enabled: usersTable.mfa_enabled, mfa_secret: usersTable.mfa_secret })
        .from(usersTable)
        .where(eq(usersTable.id, patient.id));
      expect(user.mfa_enabled).toBe(false);
      expect(user.mfa_secret).toBeNull();
    });

    it('DELETE /auth/patient/mfa rejects providers', async () => {
      const provider = await createTestProvider(container.db, { email: 'provdis@test.com', mfa_enabled: true });
      const { signAccessToken } = await import('../../src/utils/jwt');
      const access_token = signAccessToken({ id: provider.id, email: provider.email, role: 'provider' });

      const res = await request(app)
        .delete(`${API_PREFIX}/auth/patient/mfa`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ password: provider.password });

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // REFRESH TOKEN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/refresh', () => {
    it('rotates tokens on valid refresh', async () => {
      const patient = await createTestPatient(container.db, { email: 'refresh@test.com' });

      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      const { refresh_token: originalRefreshToken } = loginRes.body;

      const refreshRes = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: originalRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body).toHaveProperty('access_token');
      expect(refreshRes.body).toHaveProperty('refresh_token');
      expect(refreshRes.body.refresh_token).not.toBe(originalRefreshToken);
    });

    it('rejects an already-rotated refresh token', async () => {
      const patient = await createTestPatient(container.db, { email: 'rotated@test.com' });

      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      const { refresh_token: first } = loginRes.body;

      await request(app).post(`${API_PREFIX}/auth/refresh`).send({ refresh_token: first });

      const reuse = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: first });

      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });

    it('burns the entire token family when a replay is detected', async () => {
      // Replay scenario: an attacker steals a refresh token and uses it. The
      // legitimate user doesn't notice until their next refresh — at which
      // point they ALSO get rejected because the family was burned.
      const patient = await createTestPatient(container.db, { email: 'burn@test.com' });

      const login = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });
      const tokenA = login.body.refresh_token;

      // Legitimate first rotation → tokenA rotates to tokenB.
      const rotateA = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: tokenA });
      expect(rotateA.status).toBe(200);
      const tokenB = rotateA.body.refresh_token;

      // Attacker replays tokenA. This is the moment the breach is detected.
      const replay = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: tokenA });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // Legitimate user attempts to refresh with the (until now) valid tokenB.
      // It must also be rejected — the family was burned.
      const legit = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: tokenB });
      expect(legit.status).toBe(401);
      expect(legit.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('DELETE /auth/logout', () => {
    it('logs out and invalidates the refresh token', async () => {
      const patient = await createTestPatient(container.db, { email: 'logout@test.com' });

      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      const { access_token, refresh_token } = loginRes.body;

      const logoutRes = await request(app)
        .delete(`${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ refresh_token });

      expect(logoutRes.status).toBe(200);

      const refreshRes = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token });

      expect(refreshRes.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PASSWORD RESET
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('POST /auth/forgot-password + POST /auth/reset-password', () => {
    it('sends reset email when account exists', async () => {
      const patient = await createTestPatient(container.db, { email: 'resetme@test.com' });

      const forgotRes = await request(app)
        .post(`${API_PREFIX}/auth/forgot-password`)
        .send({ email: patient.email });

      expect(forgotRes.status).toBe(200);
      expect(sentEmails.some((e) => e.type === 'passwordReset' && e.to === patient.email)).toBe(true);
    });

    it('always returns 200 for unknown email (no enumeration)', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/forgot-password`)
        .send({ email: 'doesnotexist@test.com' });

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('PATCH /auth/change-password', () => {
    it('changes password with correct current password', async () => {
      const patient = await createTestPatient(container.db, { email: 'changepw@test.com', password: 'Test@1234!' });

      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      const { access_token } = loginRes.body;

      const res = await request(app)
        .patch(`${API_PREFIX}/auth/change-password`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ current_password: 'Test@1234!', new_password: 'NewPass@5678!' });

      expect(res.status).toBe(200);
    });

    it('rejects with incorrect current password', async () => {
      const patient = await createTestPatient(container.db, { email: 'wrongcurr@test.com' });

      const loginRes = await request(app)
        .post(`${API_PREFIX}/auth/patient/login`)
        .send({ email: patient.email, password: patient.password });

      const { access_token } = loginRes.body;

      const res = await request(app)
        .patch(`${API_PREFIX}/auth/change-password`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ current_password: 'WrongPass@1', new_password: 'NewPass@5678!' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // AUTH GUARDS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('Authentication guards', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app).delete(`${API_PREFIX}/auth/logout`);
      expect(res.status).toBe(401);
    });

    it('returns 401 with an invalid token', async () => {
      const res = await request(app)
        .delete(`${API_PREFIX}/auth/logout`)
        .set('Authorization', 'Bearer not_a_valid_token');
      expect(res.status).toBe(401);
    });
  });
});
