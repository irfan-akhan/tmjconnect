import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import { createCircuitBreaker } from './circuitBreaker';

export interface PushService {
  sendPush(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}

/**
 * Creates the push notification service backed by Firebase FCM.
 * If credentials are absent in development: no-op (stub mode).
 * If credentials are absent in production: throws on any send attempt.
 */
export function createPushService(env: Env, logger: Logger): PushService {
  const isProduction = env.NODE_ENV === 'production';
  const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const hasCredentials = !!(
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    privateKey?.includes('-----BEGIN')
  );
  const missingCredentialKeys = [
    !env.FIREBASE_PROJECT_ID ? 'FIREBASE_PROJECT_ID' : null,
    !env.FIREBASE_CLIENT_EMAIL ? 'FIREBASE_CLIENT_EMAIL' : null,
    !privateKey?.includes('-----BEGIN') ? 'FIREBASE_PRIVATE_KEY' : null,
  ].filter((key): key is string => Boolean(key));

  if (!hasCredentials) {
    if (isProduction) {
      logger.error(
        { missingCredentialKeys, nodeEnv: env.NODE_ENV, appEnv: env.APP_ENV },
        'Firebase credentials required in production. Push service will throw on use.',
      );
    } else {
      logger.warn(
        { missingCredentialKeys, nodeEnv: env.NODE_ENV, appEnv: env.APP_ENV },
        '[PushService] Firebase credentials not set — running in stub mode (no-op).',
      );
    }
  } else {
    logger.info(
      { projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL, nodeEnv: env.NODE_ENV, appEnv: env.APP_ENV },
      '[PushService] Firebase FCM configured',
    );
  }

  let firebaseMessaging: import('firebase-admin/messaging').Messaging | null = null;
  if (hasCredentials) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin') as typeof import('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }
    firebaseMessaging = admin.messaging();
  }

  const breaker = createCircuitBreaker('push', logger);

  return {
    async sendPush(fcmToken, title, body, data) {
      if (fcmToken.startsWith('ExponentPushToken[') || fcmToken.startsWith('ExpoPushToken[')) {
        throw new Error('Push token is an Expo push token; Firebase Admin requires a native FCM registration token.');
      }

      if (!firebaseMessaging) {
        if (isProduction) throw new Error('Push service not configured: Firebase credentials missing.');
        logger.debug({ fcmToken, title }, '[PushService stub] Push would be sent');
        return;
      }

      try {
        await breaker.execute(async () => {
          await firebaseMessaging!.send({
            token: fcmToken,
            notification: { title, body },
            data: data ?? {},
            apns: { payload: { aps: { sound: 'default' } } },
            android: { notification: { sound: 'default' } },
          });
        });
      } catch (err) {
        logger.warn({ err, fcmToken }, '[PushService] FCM send failed');
        throw err;
      }
    },
  };
}
