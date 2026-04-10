import { setupTestEnv } from '../helpers/testEnv';
setupTestEnv();

import { eq } from 'drizzle-orm';
import {
  createTestContainer,
  truncateAllTables,
  closeTestPool,
  clearStubs,
} from '../helpers/testContainer';
import { createTestPatient, createTestProvider } from '../helpers/factories';
import { createNotifyService } from '../../src/services/notify';
import { outboxJob } from '../../src/jobs/outboxJob';
import { notificationOutbox, users } from '../../src/db/schema';
import type { Container } from '../../src/config/container';

/**
 * Outbox integration tests — focus on the durability contract:
 *  - notify() persists outbox rows for every enabled channel
 *  - successful inline dispatch marks rows sent
 *  - failed inline dispatch leaves rows for the drain job
 *  - the drain job (outboxJob) actually sends pending rows
 *  - retried rows back off and stay queued instead of vanishing
 */
describe('Notification Outbox', () => {
  let container: Container;

  beforeAll(() => {
    container = createTestContainer();
  });

  beforeEach(async () => {
    await truncateAllTables();
    clearStubs();
  });

  afterAll(async () => {
    await closeTestPool();
  });

  // Wait for any in-flight Promise.all() inside notify() to settle. Inline
  // dispatch is fire-and-forget so the unit-of-test boundary needs a microtask
  // tick to observe the marked-sent state.
  const drainMicrotasks = () => new Promise((r) => setTimeout(r, 30));

  /** Build a notify service that uses the test container's DB and stub services. */
  function buildNotify(overrides: Partial<Container> = {}) {
    const c = { ...container, ...overrides };
    return createNotifyService({
      email: c.email,
      sms: c.sms,
      push: c.push,
      db: c.db,
      logger: c.logger,
    });
  }

  // ─── notify() — persistence ────────────────────────────────────────────────

  describe('notify() persists outbox rows', () => {
    it('inserts an email + push outbox row for report_submitted', async () => {
      const patient = await createTestPatient(container.db, { email: 'pa@test.com' });
      const provider = await createTestProvider(container.db, { email: 'pr@test.com' });
      // Set the provider's fcm_token so the push channel is eligible.
      await container.db.update(users).set({ fcm_token: 'fcm-test' }).where(eq(users.id, provider.id));

      const notify = buildNotify();
      await notify.notify({
        userId: provider.id,
        type: 'report_submitted',
        title: 'New report',
        body: 'A new report was submitted.',
        data: { reportId: 'r1' },
      });
      await drainMicrotasks();

      const rows = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.user_id, provider.id));
      expect(rows.length).toBe(2);
      const channels = rows.map((r) => r.channel).sort();
      expect(channels).toEqual(['email', 'push']);

      // Both inline dispatches should have succeeded against the stub services.
      for (const r of rows) {
        expect(r.sent_at).not.toBeNull();
        expect(r.attempts).toBe(0);
        expect(r.last_error).toBeNull();
      }
      void patient;
    });

    it('only inserts SMS when the user has a phone number', async () => {
      const provider = await createTestProvider(container.db, { email: 'sm@test.com' });
      // No phone set — SMS row should not be created even for report_urgent.
      const notify = buildNotify();
      await notify.notify({
        userId: provider.id,
        type: 'report_urgent',
        title: 'Urgent report',
        body: 'Action needed.',
      });
      await drainMicrotasks();

      const rows = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.user_id, provider.id));
      expect(rows.some((r) => r.channel === 'sms')).toBe(false);
    });
  });

  // ─── notify() — inline dispatch failure ────────────────────────────────────

  describe('notify() leaves failed rows for the drain job', () => {
    it('marks rows as failed (not sent) when the channel throws', async () => {
      const provider = await createTestProvider(container.db, { email: 'fail@test.com' });

      // Replace the stub email with one that always throws.
      const failingEmail = {
        sendVerifyEmail: () => Promise.reject(new Error('resend down')),
        sendWelcome: () => Promise.reject(new Error('resend down')),
        sendPasswordReset: () => Promise.reject(new Error('resend down')),
        sendNewDeviceLogin: () => Promise.reject(new Error('resend down')),
        sendAccountLocked: () => Promise.reject(new Error('resend down')),
        sendLinkAccepted: () => Promise.reject(new Error('resend down')),
        sendReportSubmitted: () => Promise.reject(new Error('resend down')),
        sendReportReviewed: () => Promise.reject(new Error('resend down')),
        sendWeeklyDigest: () => Promise.reject(new Error('resend down')),
        sendEmailInvite: () => Promise.reject(new Error('resend down')),
      };

      const notify = buildNotify({ email: failingEmail as Container['email'] });
      await notify.notify({
        userId: provider.id,
        type: 'link_accepted',
        title: 'Patient connected',
        body: 'A patient accepted your invitation.',
        data: { providerName: 'Dr. X', patientName: 'Y' },
      });
      // Wait long enough for the inline dispatch promise to reject and the
      // failed-row update to land.
      await new Promise((r) => setTimeout(r, 100));

      const rows = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.user_id, provider.id));
      expect(rows.length).toBe(1);
      expect(rows[0].channel).toBe('email');
      expect(rows[0].sent_at).toBeNull();
      expect(rows[0].attempts).toBe(1);
      expect(rows[0].last_error).toContain('resend down');
    });
  });

  // ─── outboxJob — drains pending rows ───────────────────────────────────────

  describe('outboxJob drain', () => {
    it('marks an unsent row as sent on successful dispatch', async () => {
      const provider = await createTestProvider(container.db, { email: 'drain@test.com' });
      // Insert a row directly (simulating one that was left behind by a previous failure).
      const [inserted] = await container.db
        .insert(notificationOutbox)
        .values({
          user_id: provider.id,
          channel: 'email',
          type: 'welcome',
          payload: { to: provider.email, name: 'Test', body: 'hi', data: {} },
          attempts: 1,
          last_error: 'transient',
          // next_attempt_at default = NOW() so it's eligible immediately.
        })
        .returning({ id: notificationOutbox.id });

      await outboxJob(container);

      const [after] = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, inserted.id));
      expect(after.sent_at).not.toBeNull();
      expect(after.last_error).toBeNull();
    });

    it('does not pick up rows whose next_attempt_at is in the future', async () => {
      const provider = await createTestProvider(container.db, { email: 'future@test.com' });
      const future = new Date(Date.now() + 60 * 60 * 1000); // +1h
      const [inserted] = await container.db
        .insert(notificationOutbox)
        .values({
          user_id: provider.id,
          channel: 'email',
          type: 'welcome',
          payload: { to: provider.email, name: 'Test', body: 'hi', data: {} },
          attempts: 2,
          next_attempt_at: future,
        })
        .returning({ id: notificationOutbox.id });

      await outboxJob(container);

      const [after] = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, inserted.id));
      expect(after.sent_at).toBeNull();
      expect(after.attempts).toBe(2); // unchanged
    });

    it('skips rows that have exhausted max_attempts (DLQ)', async () => {
      const provider = await createTestProvider(container.db, { email: 'dlq@test.com' });
      const [inserted] = await container.db
        .insert(notificationOutbox)
        .values({
          user_id: provider.id,
          channel: 'email',
          type: 'welcome',
          payload: { to: provider.email, name: 'Test', body: 'hi', data: {} },
          attempts: 5,
          max_attempts: 5,
          last_error: 'gave up',
        })
        .returning({ id: notificationOutbox.id });

      await outboxJob(container);

      const [after] = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, inserted.id));
      // The drain job must NOT touch DLQ rows — they wait for an operator.
      expect(after.attempts).toBe(5);
      expect(after.sent_at).toBeNull();
    });

    it('schedules the next retry when dispatch fails', async () => {
      const provider = await createTestProvider(container.db, { email: 'retry@test.com' });
      const [inserted] = await container.db
        .insert(notificationOutbox)
        .values({
          user_id: provider.id,
          channel: 'email',
          type: 'welcome',
          payload: { to: provider.email, name: 'Test', body: 'hi', data: {} },
        })
        .returning({ id: notificationOutbox.id });

      // Failing email service for this run.
      const failingContainer: Container = {
        ...container,
        email: {
          sendVerifyEmail: () => Promise.reject(new Error('boom')),
          sendWelcome: () => Promise.reject(new Error('boom')),
          sendPasswordReset: () => Promise.reject(new Error('boom')),
          sendNewDeviceLogin: () => Promise.reject(new Error('boom')),
          sendAccountLocked: () => Promise.reject(new Error('boom')),
          sendLinkAccepted: () => Promise.reject(new Error('boom')),
          sendReportSubmitted: () => Promise.reject(new Error('boom')),
          sendReportReviewed: () => Promise.reject(new Error('boom')),
          sendWeeklyDigest: () => Promise.reject(new Error('boom')),
          sendEmailInvite: () => Promise.reject(new Error('boom')),
        } as Container['email'],
      };
      await outboxJob(failingContainer);

      const [after] = await container.db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.id, inserted.id));
      expect(after.attempts).toBe(1);
      expect(after.sent_at).toBeNull();
      expect(after.last_error).toContain('boom');
      // Backoff: pow(2, 0) = 1 minute. Should be ~60s in the future.
      expect(after.next_attempt_at.getTime()).toBeGreaterThan(Date.now() + 30_000);
    });
  });
});
