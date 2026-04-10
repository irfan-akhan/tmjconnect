import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import request from 'supertest';
import type express from 'express';
import { eq } from 'drizzle-orm';
import { buildTestApp, bearerFor } from '../helpers/testApp';
import {
  createTestPatient,
  createTestProvider,
  createTestAdmin,
  type TestUser,
} from '../helpers/factories';
import {
  closeTestPool,
  truncateAllTables,
  clearStubs,
} from '../helpers/testContainer';
import { API_PREFIX } from '../../src/config/constants';
import { adminRouter } from '../../src/routes/admin';
import {
  auditLogs,
  loginEvents,
  reports,
  patientProviderLinks,
  users,
} from '../../src/db/schema';

describe('Admin Routes', () => {
  let app: express.Application;
  let container: ReturnType<typeof buildTestApp>['container'];
  let admin: TestUser;
  let adminAuth: string;

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
    ({ app, container } = buildTestApp({ '/admin': adminRouter }));
    admin = await createTestAdmin(container.db, { email: 'admin@test.com' });
    adminAuth = bearerFor(admin);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // ─── Role gates ──────────────────────────────────────────────────────────────

  describe('Role gating', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get(`${API_PREFIX}/admin/stats`);
      expect(res.status).toBe(401);
    });

    it('rejects patients', async () => {
      const patient = await createTestPatient(container.db, { email: 'p@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/admin/stats`)
        .set('Authorization', bearerFor(patient));
      expect(res.status).toBe(403);
    });

    it('rejects providers', async () => {
      const provider = await createTestProvider(container.db, { email: 'pr@test.com' });
      const res = await request(app)
        .get(`${API_PREFIX}/admin/stats`)
        .set('Authorization', bearerFor(provider));
      expect(res.status).toBe(403);
    });
  });

  // ─── Dashboard stats ─────────────────────────────────────────────────────────

  describe('GET /admin/stats', () => {
    it('returns stats for admin', async () => {
      await createTestPatient(container.db, { email: 'p1@test.com' });
      await createTestProvider(container.db, { email: 'pr1@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/stats`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ─── User management ─────────────────────────────────────────────────────────

  describe('GET /admin/users', () => {
    it('lists all users with pagination', async () => {
      await createTestPatient(container.db, { email: 'p1@test.com' });
      await createTestProvider(container.db, { email: 'pr1@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/users`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      // admin + patient + provider = at least 3
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('page');
    });

    it('filters by role', async () => {
      await createTestPatient(container.db, { email: 'p1@test.com' });
      await createTestPatient(container.db, { email: 'p2@test.com' });
      await createTestProvider(container.db, { email: 'pr1@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/users?role=patient`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.role).toBe('patient');
      }
    });

    it('searches by email', async () => {
      await createTestPatient(container.db, { email: 'findme@test.com' });
      await createTestPatient(container.db, { email: 'other@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/users?search=findme`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('findme@test.com');
    });
  });

  describe('GET /admin/users/:id', () => {
    it('returns user detail with audit logs and login events', async () => {
      const patient = await createTestPatient(container.db, { email: 'detail@test.com' });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/users/${patient.id}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data).toHaveProperty('recent_audit_logs');
      expect(res.body.data).toHaveProperty('recent_login_events');
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/admin/users/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('deactivates a user', async () => {
      const patient = await createTestPatient(container.db, { email: 'deact@test.com' });

      const res = await request(app)
        .patch(`${API_PREFIX}/admin/users/${patient.id}`)
        .set('Authorization', adminAuth)
        .send({ is_active: false });
      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(false);
    });

    it('reactivates a user', async () => {
      const patient = await createTestPatient(container.db, { email: 'react@test.com' });
      // Deactivate first.
      await container.db.update(users).set({ is_active: false }).where(eq(users.id, patient.id));

      const res = await request(app)
        .patch(`${API_PREFIX}/admin/users/${patient.id}`)
        .set('Authorization', adminAuth)
        .send({ is_active: true });
      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(true);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app)
        .patch(`${API_PREFIX}/admin/users/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', adminAuth)
        .send({ is_active: false });
      expect(res.status).toBe(404);
    });

    it('writes an audit log entry', async () => {
      const patient = await createTestPatient(container.db, { email: 'auditadmin@test.com' });

      await request(app)
        .patch(`${API_PREFIX}/admin/users/${patient.id}`)
        .set('Authorization', adminAuth)
        .send({ is_active: false });

      // Wait for fire-and-forget audit insert.
      let entry: typeof auditLogs.$inferSelect | undefined;
      for (let i = 0; i < 10; i++) {
        const rows = await container.db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.action, 'admin_user_updated'));
        if (rows.length > 0) {
          entry = rows[0];
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(entry).toBeDefined();
      expect(entry?.user_id).toBe(admin.id);
    });
  });

  // ─── Audit logs ──────────────────────────────────────────────────────────────

  describe('GET /admin/audit-logs', () => {
    it('returns paginated audit logs', async () => {
      // Seed an audit row.
      await container.db.insert(auditLogs).values({
        user_id: admin.id,
        action: 'test_action',
        resource_type: 'test',
        ip_address: '127.0.0.1',
      });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/audit-logs`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('filters by action', async () => {
      await container.db.insert(auditLogs).values([
        { user_id: admin.id, action: 'alpha', ip_address: '127.0.0.1' },
        { user_id: admin.id, action: 'beta', ip_address: '127.0.0.1' },
      ]);

      const res = await request(app)
        .get(`${API_PREFIX}/admin/audit-logs?action=alpha`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      for (const log of res.body.data) {
        expect(log.action).toBe('alpha');
      }
    });
  });

  describe('GET /admin/audit-logs/export', () => {
    it('exports CSV with correct headers', async () => {
      await container.db.insert(auditLogs).values({
        user_id: admin.id,
        action: 'export_test',
        resource_type: 'test',
        ip_address: '127.0.0.1',
      });

      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const res = await request(app)
        .get(`${API_PREFIX}/admin/audit-logs/export?from=${today}&to=${tomorrow}`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(res.text).toContain('id,user_id,action,resource_type');
      expect(res.text).toContain('export_test');
    });

    it('rejects date range exceeding 90 days', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/admin/audit-logs/export?from=2026-01-01&to=2026-06-01`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
    });
  });

  // ─── Login events ────────────────────────────────────────────────────────────

  describe('GET /admin/login-events', () => {
    it('returns paginated login events', async () => {
      await container.db.insert(loginEvents).values({
        user_id: admin.id,
        email: admin.email,
        success: true,
        ip_address: '127.0.0.1',
        device_info: 'test',
      });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/login-events`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('filters by success/failure', async () => {
      await container.db.insert(loginEvents).values([
        { user_id: admin.id, email: admin.email, success: true, ip_address: '1.1.1.1' },
        { user_id: admin.id, email: admin.email, success: false, ip_address: '1.1.1.1', failure_reason: 'invalid_password' },
      ]);

      const res = await request(app)
        .get(`${API_PREFIX}/admin/login-events?success=false`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      for (const evt of res.body.data) {
        expect(evt.success).toBe(false);
      }
    });
  });

  // ─── Reports (cross-provider) ────────────────────────────────────────────────

  describe('GET /admin/reports', () => {
    it('lists reports across all providers', async () => {
      const patient = await createTestPatient(container.db, { email: 'rp@test.com' });
      const provider = await createTestProvider(container.db, { email: 'rpr@test.com' });
      await container.db.insert(patientProviderLinks).values({
        patient_id: patient.id,
        provider_id: provider.id,
      });
      await container.db.insert(reports).values({
        patient_id: patient.id,
        provider_id: provider.id,
        urgency: 'routine',
        description: 'admin report test',
        status: 'submitted',
      });

      const res = await request(app)
        .get(`${API_PREFIX}/admin/reports`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('validates query params via Zod (rejects non-numeric page)', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/admin/reports?page=abc`)
        .set('Authorization', adminAuth);
      // z.coerce.number() will coerce "abc" to NaN, which fails .int().min(1)
      expect(res.status).toBe(400);
    });
  });

  // ─── Deactivated user guard (is_active check in authenticate) ────────────────

  describe('Deactivated user guard', () => {
    it('rejects a deactivated admin with a valid JWT', async () => {
      // Deactivate the admin after JWT was issued.
      await container.db.update(users).set({ is_active: false }).where(eq(users.id, admin.id));

      const res = await request(app)
        .get(`${API_PREFIX}/admin/stats`)
        .set('Authorization', adminAuth);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    });
  });
});
