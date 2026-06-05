import type { NotificationType } from '@tmjconnect/shared';
import type { EmailService } from './email';
import type { SmsService } from './sms';
import type { PushService } from './push';

/**
 * notifyDispatch — Pure dispatcher that converts an outbox row into a concrete
 * channel call. Used by both the inline send in `notify()` and the background
 * `outboxJob` drain. Keeping the dispatch logic here (and not duplicated in
 * the job file) is what makes the outbox pattern safe — there is exactly one
 * code path that knows how to turn a row into a Resend/Twilio/FCM call.
 */

export type OutboxPayload = Record<string, unknown>;

export interface OutboxDispatchInput {
  channel: 'email' | 'sms' | 'push';
  type: NotificationType;
  payload: OutboxPayload;
}

export interface OutboxDispatchDeps {
  email: EmailService;
  sms: SmsService;
  push: PushService;
}

/**
 * Dispatches one outbox row. Throws on failure — the caller decides whether
 * to mark sent or schedule a retry.
 */
export async function dispatchOutboxRow(
  deps: OutboxDispatchDeps,
  row: OutboxDispatchInput,
): Promise<void> {
  switch (row.channel) {
    case 'push':
      await dispatchPush(deps.push, row);
      return;
    case 'email':
      await dispatchEmail(deps.email, row);
      return;
    case 'sms':
      await dispatchSms(deps.sms, row);
      return;
  }
}

async function dispatchPush(push: PushService, row: OutboxDispatchInput): Promise<void> {
  const fcmToken = String(row.payload.fcm_token ?? '');
  const title = String(row.payload.title ?? '');
  const body = String(row.payload.body ?? '');
  const data = (row.payload.data as Record<string, unknown> | undefined) ?? {};
  if (!fcmToken) throw new Error('push payload missing fcm_token');
  const stringData = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
  await push.sendPush(fcmToken, title, body, {
    ...stringData,
    type: normalizePushNavigationType(row.type, data),
    notificationType: row.type,
  });
}

function normalizePushNavigationType(type: NotificationType, data: Record<string, unknown>): string {
  const explicitType = typeof data.type === 'string' ? data.type : '';
  if (explicitType === 'exercise' || explicitType === 'report' || explicitType === 'symptom') return explicitType;
  if (type === 'exercise_assigned' || type === 'exercise_reminder') return 'exercise';
  if (type === 'symptom_checkin') return 'symptom';
  if (type.startsWith('report_')) return 'report';
  return type;
}

async function dispatchSms(sms: SmsService, row: OutboxDispatchInput): Promise<void> {
  const to = String(row.payload.to ?? '');
  const body = String(row.payload.body ?? '');
  if (!to) throw new Error('sms payload missing recipient');
  await sms.sendUrgentAlert(to, body);
}

async function dispatchEmail(email: EmailService, row: OutboxDispatchInput): Promise<void> {
  const to = String(row.payload.to ?? '');
  const name = String(row.payload.name ?? '');
  const body = String(row.payload.body ?? '');
  const data = (row.payload.data as Record<string, unknown> | undefined) ?? {};
  if (!to) throw new Error('email payload missing recipient');
  const firstName = name.split(' ')[0] ?? '';

  // Same template routing as the pre-outbox notify implementation.
  switch (row.type) {
    case 'provider_message':
      await email.sendProviderMessage(to, firstName, body);
      return;
    case 'welcome':
      await email.sendWelcome(to, firstName);
      return;
    case 'password_reset':
      await email.sendPasswordReset(to, String(data.resetUrl ?? '#'));
      return;
    case 'new_device_login':
      await email.sendNewDeviceLogin(to, firstName, String(data.ip ?? ''), String(data.device ?? ''));
      return;
    case 'account_locked':
      await email.sendAccountLocked(to, firstName);
      return;
    case 'exercise_assigned':
      await email.sendExerciseAssigned(
        to,
        firstName,
        String(data.exerciseTitle ?? row.payload.body ?? 'New exercise'),
        String(data.frequency ?? ''),
        Number(data.sets ?? 0),
      );
      return;
    case 'link_accepted':
      await email.sendLinkAccepted(
        to,
        String(data.providerName ?? ''),
        String(data.patientName ?? ''),
        data.recipientRole === 'patient' ? 'patient' : 'provider',
      );
      return;
    case 'report_submitted':
    case 'report_urgent':
      await email.sendReportSubmitted(
        to,
        String(data.providerName ?? ''),
        String(data.patientName ?? ''),
        String(data.urgency ?? 'routine'),
      );
      return;
    case 'report_requested':
      await email.sendReportRequested(to, firstName, body);
      return;
    case 'report_reviewed':
      await email.sendReportReviewed(to, firstName);
      return;
    case 'weekly_summary':
      await email.sendWeeklyDigest(to, firstName, {
        avgPainLevel: Number(data.avgPainLevel ?? 0),
        exercisesCompleted: Number(data.exercisesCompleted ?? 0),
        completionRate: Number(data.completionRate ?? 0),
        streakDays: Number(data.streakDays ?? 0),
      });
      return;
    default:
      // No email template — silently treat as sent. Avoids the row sitting in
      // the outbox forever for notification types that have no email mapping.
      return;
  }
  // unreachable, kept for type-narrowing safety
  void body;
}
