// Local-dev env loading.
//
// On a VPS the systemd unit injects vars via `EnvironmentFile=`, so process.env
// is already populated before node starts and dotenv finds nothing to do.
//
// For local dev we load `.env.${NODE_ENV}` first (e.g. `.env.development`,
// `.env.production` if you want to mirror prod locally) and then fall back to
// a plain `.env` for any keys not set above. dotenv's first-write-wins means
// .env values do NOT override the env-specific file.
//
// Tests set every var explicitly in setupTestEnv — skip dotenv entirely there
// so a stray local `.env` can't change test behavior.
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  dotenv.config({ path: `.env.${nodeEnv}` });
  dotenv.config({ path: '.env' });
}
import { z } from 'zod';

/**
 * Zod-validated environment variable schema.
 * The server fails fast on startup if any required variable is missing or malformed.
 * Optional variables log a stub-mode warning instead of crashing.
 */
const envSchema = z.object({
  // ─── Server ──────────────────────────────────────────────────────────────────
  // NODE_ENV drives Node-runtime behavior (npm install --omit=dev, react/express
  // optimizations). Use `production` on the test VPS too — we want test to behave
  // like production, just pointed at a different DB.
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // APP_ENV is the deployment label, surfaced in logs and Sentry. Decoupled from
  // NODE_ENV so the test VPS can run `NODE_ENV=production` while still being
  // labeled `test` everywhere it matters.
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
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

  // ─── CORS (temporarily optional during initial rollout) ─────────────────────
  // TODO: Re-enable strict validation by making this required again once all
  // production clients/subdomains are finalized.
  ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS must be a comma-separated list of origins').optional(),

  // ─── Email — Twilio SendGrid (optional in dev, required in prod) ────────────
  SENDGRID_API_KEY: z.string().optional(),
  // The "from" address must be a SendGrid Single Sender (dev/test) or a
  // domain-authenticated address (prod). Defaults work only after you've
  // configured noreply@mail.tmjconnect.com in SendGrid.
  SENDGRID_FROM: z.string().optional(),

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

  // ─── API docs ────────────────────────────────────────────────────────────────
  // When true, mounts Swagger UI at /docs. Off by default — flip on per-env.
  ENABLE_DOCS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),

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
