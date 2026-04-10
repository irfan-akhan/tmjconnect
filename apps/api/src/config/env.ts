// Load .env file unless we're in test mode (tests set env vars explicitly via setupTestEnv).
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv/config');
}
import { z } from 'zod';

/**
 * Zod-validated environment variable schema.
 * The server fails fast on startup if any required variable is missing or malformed.
 * Optional variables log a stub-mode warning instead of crashing.
 */
const envSchema = z.object({
  // ─── Server ──────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ─── Database (required) ─────────────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  // ─── JWT (required) ──────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  // Optional. When set, JWT verification will accept tokens signed with the
  // PREVIOUS secret in addition to the current one. Use during a key rotation:
  //   1. Set JWT_SECRET_PREVIOUS = current JWT_SECRET
  //   2. Set JWT_SECRET = newly-generated value
  //   3. Deploy. Old tokens still verify; new tokens use the new key.
  //   4. After the access-token TTL (15 min) plus a safety margin, clear
  //      JWT_SECRET_PREVIOUS — only newly-issued tokens will then be valid.
  // Refresh tokens are opaque hashes (not JWTs), so no analogous knob exists
  // for JWT_REFRESH_SECRET — refresh-token rotation happens at the DB layer.
  JWT_SECRET_PREVIOUS: z.string().min(32).optional(),

  // ─── MFA encryption (required) ───────────────────────────────────────────────
  // 32-byte hex string (64 chars). AES-256-GCM key for encrypting TOTP secrets.
  MFA_ENCRYPTION_KEY: z.string().length(64, 'MFA_ENCRYPTION_KEY must be exactly 64 hex characters'),

  // ─── CORS (required) ─────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS must be a comma-separated list of origins'),

  // ─── Email — Resend (optional) ───────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),

  // ─── SMS — Twilio (optional) ─────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // ─── Push — Firebase FCM (optional) ──────────────────────────────────────────
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // ─── File storage ────────────────────────────────────────────────────────────
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  CLOUDFRONT_URL: z.string().optional(),

  // ─── App URLs ────────────────────────────────────────────────────────────────
  APP_URL: z.string().url().default('http://localhost:8081'),
  API_URL: z.string().url().default('http://localhost:3000'),

  // ─── Error tracking ──────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),

  // ─── Logging ─────────────────────────────────────────────────────────────────
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ─── Backup ──────────────────────────────────────────────────────────────────
  BACKUP_PASSPHRASE: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates all environment variables at startup.
 * Missing required variables cause an immediate process exit with a clear message.
 * This runs once at module load time — never at request time.
 */
function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error(`\n[FATAL] Environment validation failed:\n${errors}\n`);
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
