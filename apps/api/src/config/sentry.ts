/**
 * Sentry initialisation with HIPAA-compliant PII scrubbing.
 *
 * The beforeSend hook strips:
 * - Common PII keys (email, phone, dob, ip, names)
 * - Auth secrets (password, token, code, secret)
 * - Anything containing 'phi' (catch-all for clinical data)
 * - Authorization headers and cookies
 *
 * If SENTRY_DSN is not set, Sentry is not initialised at all (no-op).
 */
import * as Sentry from '@sentry/node';
import type { Env } from './env';
import type { Logger } from './logger';

// Keys that should always be removed from any object before sending to Sentry.
const PII_KEYS = new Set([
  // Identifiers
  'email', 'email_address',
  'phone', 'phone_number', 'mobile',
  'first_name', 'last_name', 'full_name', 'name',
  'date_of_birth', 'dob', 'birthdate',
  'address', 'street', 'city', 'state', 'zip', 'postal_code',
  'ip', 'ip_address', 'remote_addr',
  // Auth secrets
  'password', 'new_password', 'current_password',
  'token', 'access_token', 'refresh_token', 'mfa_token', 'setup_token',
  'code', 'verify_code', 'mfa_code', 'backup_code',
  'secret', 'mfa_secret', 'jwt_secret',
  'authorization', 'cookie',
  // Clinical PHI catch-alls
  'notes', 'patient_notes', 'description', 'message', 'instructions',
  'symptoms', 'pain_level', 'body_areas', 'triggers',
  'fcm_token', 'private_key',
]);

const REDACTED = '[REDACTED]';

/**
 * Recursively scrubs an object, replacing values for PII keys with '[REDACTED]'.
 * Also redacts any key whose name contains 'phi' (case-insensitive).
 * Exported for unit testing.
 */
export function scrubObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return REDACTED; // Prevent infinite recursion on circular refs
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => scrubObject(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (PII_KEYS.has(lowerKey) || lowerKey.includes('phi')) {
      result[key] = REDACTED;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = scrubObject(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Initialises Sentry. Returns true if initialised, false if skipped (no DSN).
 */
export function initSentry(env: Env, logger: Logger): boolean {
  if (!env.SENTRY_DSN) {
    logger.info('[Sentry] SENTRY_DSN not set — error tracking disabled');
    return false;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Lower sample rate in production to control cost.
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Strip PII from every event before sending.
    beforeSend(event) {
      // Scrub request data.
      if (event.request) {
        if (event.request.data) {
          event.request.data = scrubObject(event.request.data);
        }
        if (event.request.query_string) {
          // Query strings can contain tokens — drop entirely.
          event.request.query_string = REDACTED;
        }
        if (event.request.cookies) {
          delete event.request.cookies;
        }
        if (event.request.headers) {
          const headers = event.request.headers as Record<string, string>;
          for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === 'authorization' || key.toLowerCase() === 'cookie') {
              headers[key] = REDACTED;
            }
          }
        }
      }

      // Scrub user context (only keep id, never email/username).
      if (event.user) {
        event.user = { id: event.user.id };
      }

      // Scrub extra context.
      if (event.extra) {
        event.extra = scrubObject(event.extra) as Record<string, unknown>;
      }
      if (event.contexts) {
        event.contexts = scrubObject(event.contexts) as Record<string, Record<string, unknown>>;
      }

      // Scrub breadcrumbs (these often contain request bodies).
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
          ...bc,
          data: bc.data ? scrubObject(bc.data) as Record<string, unknown> : bc.data,
        }));
      }

      return event;
    },
  });

  logger.info({ env: env.NODE_ENV }, '[Sentry] Initialised with PII scrubbing');
  return true;
}

export { Sentry };
