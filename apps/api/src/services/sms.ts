import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import { createCircuitBreaker } from './circuitBreaker';

export interface SmsService {
  sendMfaCode(to: string, code: string): Promise<void>;
  sendUrgentAlert(to: string, message: string): Promise<void>;
}

/**
 * Creates the SMS service backed by Twilio.
 * If credentials are absent in development: logs to console (stub mode).
 * If credentials are absent in production: throws on any send attempt.
 */
export function createSmsService(env: Env, logger: Logger): SmsService {
  const isProduction = env.NODE_ENV === 'production';
  const hasCredentials = !!(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_PHONE_NUMBER
  );

  if (!hasCredentials) {
    if (isProduction) {
      logger.error('Twilio credentials required in production. SMS service will throw on use.');
    } else {
      logger.warn('[SmsService] Twilio credentials not set — running in stub mode (console output).');
    }
  }

  let twilioClient: import('twilio').Twilio | null = null;
  if (hasCredentials) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const twilio = require('twilio') as (sid: string, token: string) => import('twilio').Twilio;
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }

  const breaker = createCircuitBreaker('sms', logger);

  async function send(to: string, body: string): Promise<void> {
    if (!twilioClient || !env.TWILIO_PHONE_NUMBER) {
      if (isProduction) throw new Error('SMS service not configured: Twilio credentials missing.');
      logger.info({ to, body }, '[SmsService stub] SMS would be sent');
      return;
    }

    await breaker.execute(async () => {
      await twilioClient!.messages.create({
        from: env.TWILIO_PHONE_NUMBER!,
        to,
        body,
      });
    });
  }

  return {
    async sendMfaCode(to, code) {
      await send(to, `Your TMJConnect verification code is: ${code}. It expires in 5 minutes.`);
    },
    async sendUrgentAlert(to, message) {
      await send(to, `[TMJConnect URGENT] ${message}`);
    },
  };
}
