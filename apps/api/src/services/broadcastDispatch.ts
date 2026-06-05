import type { Container } from '../config/container';
import { notifications } from '../db/schema';
import { listBroadcastRecipients, type DueBroadcast } from '../db/queries/admin-p1p2.queries';

export type BroadcastDeliveryResult = {
  inAppSent: number;
  emailSent: number;
  emailFailed: number;
};

export async function dispatchBroadcast(
  container: Pick<Container, 'db' | 'email' | 'logger'>,
  broadcast: DueBroadcast,
): Promise<BroadcastDeliveryResult> {
  const recipients = await listBroadcastRecipients(container.db, broadcast.audience);
  const channels = new Set(broadcast.channels);
  let inAppSent = 0;
  let emailSent = 0;
  let emailFailed = 0;

  if (channels.has('in_app') && recipients.length > 0) {
    const inserted = await container.db
      .insert(notifications)
      .values(recipients.map((recipient) => ({
        user_id: recipient.id,
        type: 'broadcast',
        title: broadcast.title,
        body: broadcast.body,
        data: { broadcastId: broadcast.id, broadcastType: broadcast.type },
      })))
      .returning({ id: notifications.id });
    inAppSent = inserted.length;
  }

  if (channels.has('email')) {
    const emailRecipients = recipients
      .filter((recipient) => recipient.email_verified)
      .map((recipient) => recipient.email)
      .filter((email): email is string => Boolean(email));
    const results = await Promise.allSettled(
      emailRecipients.map((email) =>
        container.email.sendBroadcast(email, broadcast.title, broadcast.body, broadcast.type),
      ),
    );
    emailSent = results.filter((result) => result.status === 'fulfilled').length;
    emailFailed = results.length - emailSent;
    if (emailFailed > 0) {
      container.logger.warn(
        { broadcastId: broadcast.id, emailSent, emailFailed },
        'Broadcast email delivery had failures',
      );
    }
  }

  return { inAppSent, emailSent, emailFailed };
}