import type { EmailService } from './email';
import type { SmsService } from './sms';
import type { PushService } from './push';
import type { Db } from '../config/database';
import type { Logger } from '../config/logger';
import type { NotificationType } from '@tmjconnect/shared';
import { notifications, notificationPreferences, users, profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  insertOutboxRows,
  markOutboxSent,
  markOutboxFailed,
  type OutboxChannel,
  type OutboxInsert,
} from '../db/queries/notifications.queries';
import { dispatchOutboxRow, type OutboxPayload } from './notifyDispatch';

export interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotifyService {
  notify(options: NotifyOptions): Promise<void>;
}

// ─── Channel map (Section 9.2) ────────────────────────────────────────────────────
// Defines which channels each notification type should be dispatched to.

const CHANNEL_MAP: Record<NotificationType, { push: boolean; email: boolean; sms: boolean }> = {
  exercise_reminder:  { push: true,  email: false, sms: false },
  symptom_checkin:    { push: true,  email: false, sms: false },
  provider_message:   { push: true,  email: true,  sms: false },
  report_submitted:   { push: true,  email: true,  sms: false },
  report_urgent:      { push: true,  email: true,  sms: true  },
  report_reviewed:    { push: true,  email: false, sms: false },
  exercise_assigned:  { push: true,  email: false, sms: false },
  link_accepted:      { push: false, email: true,  sms: false },
  welcome:            { push: false, email: true,  sms: false },
  password_reset:     { push: false, email: true,  sms: false },
  mfa_code:           { push: false, email: false, sms: true  },
  new_device_login:   { push: false, email: true,  sms: false },
  weekly_summary:     { push: true,  email: true,  sms: false },
  account_locked:     { push: false, email: true,  sms: false },
  streak_milestone:   { push: true,  email: false, sms: false },
  report_requested:   { push: true,  email: true,  sms: false },
};

/**
 * Creates the unified notification dispatcher.
 *
 * notify() is the ONLY way the application dispatches notifications.
 * Route handlers never call Resend, Twilio, or FCM directly.
 *
 * Order of operations (with the transactional outbox pattern):
 *  1. Insert the in-app notification row (source of truth for the UI).
 *  2. Read user prefs + recipient info to compute the per-channel payloads.
 *  3. Insert one notification_outbox row per enabled external channel.
 *     This is the durable record — even if the immediate dispatch below fails,
 *     the drain job (outboxJob) will retry until success or DLQ.
 *  4. Attempt immediate dispatch on every newly-inserted row. On success,
 *     mark sent. On failure, leave the row for the drain job to retry.
 *
 * The immediate dispatch is fire-and-forget — the calling request returns as
 * soon as the outbox rows are persisted (step 3). This keeps request latency
 * close to the pre-outbox behaviour while making delivery durable.
 */
export function createNotifyService({
  email,
  sms,
  push,
  db,
  logger,
}: {
  email: EmailService;
  sms: SmsService;
  push: PushService;
  db: Db['db'];
  logger: Logger;
}): NotifyService {
  return {
    async notify({ userId, type, title, body, data = {} }) {
      // Step 1: in-app notification row.
      try {
        await db.insert(notifications).values({ user_id: userId, type, title, body, data });
      } catch (err) {
        logger.error(
          { err, userId, type, title, body, data, notification_lost: true },
          'Failed to insert in-app notification',
        );
        // Don't propagate — the calling route handler must still succeed.
        return;
      }

      // Step 2: load prefs + recipient info.
      const [prefs, userRow] = await Promise.all([
        db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.user_id, userId))
          .limit(1),
        db
          .select({
            fcm_token: users.fcm_token,
            email: users.email,
            phone: users.phone,
            first_name: profiles.first_name,
            last_name: profiles.last_name,
          })
          .from(users)
          .leftJoin(profiles, eq(profiles.user_id, users.id))
          .where(eq(users.id, userId))
          .limit(1),
      ]).catch((err) => {
        logger.error({ err, userId }, 'Failed to fetch user prefs for notification dispatch');
        return [[], []];
      });

      const pref = prefs[0];
      const user = userRow[0];
      if (!pref || !user) return;

      // Step 3: build per-channel outbox rows for the enabled channels.
      const channels = CHANNEL_MAP[type];
      const outboxRows: OutboxInsert[] = [];
      const recipientName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();

      if (channels.push && user.fcm_token) {
        outboxRows.push({
          user_id: userId,
          channel: 'push' as OutboxChannel,
          type,
          payload: { fcm_token: user.fcm_token, title, body, data } satisfies OutboxPayload,
        });
      }

      if (channels.email && user.email && shouldEmailUser(type, pref)) {
        outboxRows.push({
          user_id: userId,
          channel: 'email' as OutboxChannel,
          type,
          payload: { to: user.email, name: recipientName, body, data } satisfies OutboxPayload,
        });
      }

      if (channels.sms && user.phone) {
        outboxRows.push({
          user_id: userId,
          channel: 'sms' as OutboxChannel,
          type,
          payload: { to: user.phone, body } satisfies OutboxPayload,
        });
      }

      if (outboxRows.length === 0) return;

      let insertedIds: string[] = [];
      try {
        insertedIds = await insertOutboxRows(db, outboxRows);
      } catch (err) {
        logger.error(
          { err, userId, type, notification_lost: true },
          'Failed to insert notification outbox rows',
        );
        return;
      }

      // Step 4: best-effort immediate dispatch. Errors leave the row for the
      // drain job. This is fire-and-forget so the request returns now.
      void Promise.all(
        insertedIds.map(async (id, idx) => {
          const row = outboxRows[idx];
          try {
            await dispatchOutboxRow(
              { email, sms, push },
              { channel: row.channel, type: row.type as NotificationType, payload: row.payload },
            );
            await markOutboxSent(db, id);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.warn(
              { err, userId, type, channel: row.channel },
              'Inline outbox dispatch failed — will retry via drain job',
            );
            await markOutboxFailed(db, id, message).catch((updateErr) =>
              logger.error({ updateErr, id }, 'Failed to mark outbox row as failed'),
            );
          }
        }),
      );
    },
  };
}

function shouldEmailUser(
  type: NotificationType,
  pref: typeof notificationPreferences.$inferSelect,
): boolean {
  if (pref.email_digest === 'off') return false;
  // Transactional/security emails always send regardless of preferences.
  const alwaysSend: NotificationType[] = [
    'welcome', 'password_reset', 'new_device_login', 'account_locked', 'mfa_code',
  ];
  if (alwaysSend.includes(type)) return true;
  // Respect user preferences for other notification types.
  if (type === 'exercise_reminder' || type === 'exercise_assigned') return pref.exercise_reminders;
  if (type === 'symptom_checkin') return pref.symptom_checkin;
  if (type === 'provider_message') return pref.provider_messages;
  if (type === 'report_submitted' || type === 'report_reviewed' || type === 'report_urgent') return pref.report_updates;
  return true;
}
