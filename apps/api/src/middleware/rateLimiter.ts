import { RateLimiterPostgres, RateLimiterRes } from 'rate-limiter-flexible';
import type { Pool } from 'pg';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  RATE_LIMIT_GENERAL_MAX,
  RATE_LIMIT_GENERAL_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_MFA_MAX,
  RATE_LIMIT_MFA_WINDOW_MS,
  RATE_LIMIT_PASSWORD_RESET_MAX,
  RATE_LIMIT_PASSWORD_RESET_WINDOW_MS,
  RATE_LIMIT_EMAIL_VERIFY_MAX,
  RATE_LIMIT_EMAIL_VERIFY_WINDOW_MS,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_WINDOW_MINUTES,
  EMAIL_VERIFY_MAX_ATTEMPTS,
  EMAIL_VERIFY_TTL_HOURS,
} from '../config/constants';

// ─── Shared options ───────────────────────────────────────────────────────────────

const pgOpts = (pool: Pool) => ({
  storeClient: pool,
  // rate-limiter-flexible manages its own tables — no Drizzle migration needed.
  // Each limiter creates its table on first use if it does not already exist.
});

// ─── IP middleware factory ─────────────────────────────────────────────────────────

/**
 * Wraps a RateLimiterPostgres in an Express middleware keyed on the client IP.
 * req.ip reflects the real IP when app.set('trust proxy', 1) is enabled behind Nginx.
 *
 * Sets standard Retry-After header on 429.
 */
function ipMiddleware(limiter: RateLimiterPostgres): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await limiter.consume(req.ip ?? 'unknown');
      next();
    } catch (err) {
      if (err instanceof RateLimiterRes) {
        const rl = err as RateLimiterRes;
        const retryAfter = Math.ceil(rl.msBeforeNext / 1000);
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retryAfter,
          },
        });
        return;
      }
      next(err as Error);
    }
  };
}

// ─── IP-based route limiters ──────────────────────────────────────────────────────

/**
 * createRateLimiters(pool) — Five IP-keyed middleware tiers (unchanged external API).
 *
 * Tiers per architecture spec Section 14.3:
 *   general      — 100 req / 15 min (mounted globally on all routes)
 *   auth         — 10 req  / 15 min (login, register, forgot-password)
 *   mfa          — 5 req   / 5 min  (/auth/mfa/* routes)
 *   passwordReset— 3 req   / 1 hr   (/auth/reset-password)
 *   emailVerify  — 5 req   / 15 min (/auth/verify-email, /auth/resend-verify-email)
 *
 * Unlike express-rate-limit, duration is specified in seconds here.
 * rate-limiter-flexible uses seconds; the *_WINDOW_MS constants are converted.
 */
export function createRateLimiters(pool: Pool): {
  general: RequestHandler;
  auth: RequestHandler;
  mfa: RequestHandler;
  passwordReset: RequestHandler;
  emailVerify: RequestHandler;
} {
  const base = pgOpts(pool);

  return {
    general: ipMiddleware(
      new RateLimiterPostgres({
        ...base,
        tableName: 'rl_general',
        keyPrefix: 'gen',
        points: RATE_LIMIT_GENERAL_MAX,
        duration: RATE_LIMIT_GENERAL_WINDOW_MS / 1000,
      }),
    ),

    auth: ipMiddleware(
      new RateLimiterPostgres({
        ...base,
        tableName: 'rl_auth',
        keyPrefix: 'auth',
        points: RATE_LIMIT_AUTH_MAX,
        duration: RATE_LIMIT_AUTH_WINDOW_MS / 1000,
      }),
    ),

    mfa: ipMiddleware(
      new RateLimiterPostgres({
        ...base,
        tableName: 'rl_mfa',
        keyPrefix: 'mfa',
        points: RATE_LIMIT_MFA_MAX,
        duration: RATE_LIMIT_MFA_WINDOW_MS / 1000,
      }),
    ),

    passwordReset: ipMiddleware(
      new RateLimiterPostgres({
        ...base,
        tableName: 'rl_password_reset',
        keyPrefix: 'reset',
        points: RATE_LIMIT_PASSWORD_RESET_MAX,
        duration: RATE_LIMIT_PASSWORD_RESET_WINDOW_MS / 1000,
      }),
    ),

    emailVerify: ipMiddleware(
      new RateLimiterPostgres({
        ...base,
        tableName: 'rl_email_verify',
        keyPrefix: 'ev',
        points: RATE_LIMIT_EMAIL_VERIFY_MAX,
        duration: RATE_LIMIT_EMAIL_VERIFY_WINDOW_MS / 1000,
      }),
    ),
  };
}

// ─── Email-keyed brute-force limiters ─────────────────────────────────────────────

/**
 * createAuthLimiters(pool) — Two email-keyed limiters used directly inside route handlers.
 * These replace the hand-written SQL queries that previously enforced the same logic.
 *
 * loginLimiter:
 *   Tracks failed password attempts per email address.
 *   5 failures in 30 min → blockDuration of 30 min (all subsequent consume() calls
 *   throw RateLimiterRes immediately, regardless of correct password).
 *   On successful login: delete(email) resets the counter.
 *
 * emailVerifyLimiter:
 *   Tracks wrong verification code submissions per email address.
 *   5 wrong codes within the code's TTL → consume() throws RateLimiterRes.
 *   Route handler catches this and invalidates the code, forcing the user to request
 *   a new one. On successful verification: delete(email) resets the counter.
 */
export function createAuthLimiters(pool: Pool) {
  const base = pgOpts(pool);

  const loginLimiter = new RateLimiterPostgres({
    ...base,
    tableName: 'rl_login',
    keyPrefix: 'login',
    points: LOCKOUT_MAX_ATTEMPTS,
    duration: LOCKOUT_WINDOW_MINUTES * 60,
    blockDuration: LOCKOUT_WINDOW_MINUTES * 60,
  });

  // blockDuration is 0: no auto-block. The handler invalidates the code on exhaustion.
  const emailVerifyLimiter = new RateLimiterPostgres({
    ...base,
    tableName: 'rl_ev_code',
    keyPrefix: 'ev_code',
    points: EMAIL_VERIFY_MAX_ATTEMPTS,
    duration: EMAIL_VERIFY_TTL_HOURS * 60 * 60,
    blockDuration: 0,
  });

  return { loginLimiter, emailVerifyLimiter };
}

export type AuthLimiters = ReturnType<typeof createAuthLimiters>;

// Re-export RateLimiterRes so callers can import from one place.
export { RateLimiterRes };
