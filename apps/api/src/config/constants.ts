/**
 * Named constants for the TMJConnect API.
 * No magic numbers scattered across the codebase.
 * All durations are in milliseconds unless explicitly noted.
 */

// ─── API ─────────────────────────────────────────────────────────────────────────
export const API_PREFIX = '/api/v1';

// ─── Auth token expiry ───────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;          // 15 minutes
export const REFRESH_TOKEN_TTL_DAYS = 7;                   // 7 days
export const MFA_TOKEN_TTL_SECONDS = 5 * 60;               // 5 minutes
export const MFA_SETUP_TOKEN_TTL_SECONDS = 10 * 60;        // 10 minutes
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;         // 1 hour (legacy deep-link reset)
export const PASSWORD_RESET_OTP_TTL_SECONDS = 15 * 60;     // 15 minutes
export const PASSWORD_RESET_SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

// ─── Security ────────────────────────────────────────────────────────────────────
export const BCRYPT_ROUNDS = 12;
export const REFRESH_TOKEN_BYTE_LENGTH = 64;
export const PASSWORD_RESET_TOKEN_BYTE_LENGTH = 64;
export const VERIFY_CODE_MIN = 100000;
export const VERIFY_CODE_MAX = 999999;
export const SMS_MFA_CODE_LENGTH = 6;
export const BACKUP_CODE_COUNT = 10;
export const BACKUP_CODE_BYTE_LENGTH = 5;  // 5 bytes → 10-char hex string
export const LINKING_CODE_LENGTH = 6;
export const LINKING_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ─── Account lockout ─────────────────────────────────────────────────────────────
export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MINUTES = 30;

// ─── Email verification ───────────────────────────────────────────────────────────
export const EMAIL_VERIFY_TTL_HOURS = 24;
export const EMAIL_VERIFY_MAX_ATTEMPTS = 3;    // After 3 failures, code is invalidated
export const RESEND_VERIFY_COOLDOWN_SECONDS = 120;  // 1 per 2 minutes per email
export const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 3;

// ─── Session ─────────────────────────────────────────────────────────────────────
export const PROVIDER_SESSION_TIMEOUT_MINUTES = 15;

// ─── Rate limiting ────────────────────────────────────────────────────────────────
export const RATE_LIMIT_GENERAL_MAX = 100;
export const RATE_LIMIT_GENERAL_WINDOW_MS = 15 * 60 * 1000;

export const RATE_LIMIT_AUTH_MAX = 10;
export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;

export const RATE_LIMIT_MFA_MAX = 5;
export const RATE_LIMIT_MFA_WINDOW_MS = 5 * 60 * 1000;

export const RATE_LIMIT_PASSWORD_RESET_MAX = 3;
export const RATE_LIMIT_PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

export const RATE_LIMIT_EMAIL_VERIFY_MAX = 5;
export const RATE_LIMIT_EMAIL_VERIFY_WINDOW_MS = 15 * 60 * 1000;

// ─── Request timeout ─────────────────────────────────────────────────────────────
export const REQUEST_TIMEOUT_MS = 30 * 1000;  // 30 seconds → 408

// ─── Pagination ──────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

// ─── Uploads ─────────────────────────────────────────────────────────────────────
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;    // 100 MB
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;     // 5 MB
export const MAX_REPORT_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_THUMBNAIL_SIZE_BYTES = 2 * 1024 * 1024;  // 2 MB

export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/quicktime'] as const;
export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png'] as const;

// ─── Circuit breaker ─────────────────────────────────────────────────────────────
export const CIRCUIT_BREAKER_THRESHOLD = 5;     // Failures before opening
export const CIRCUIT_BREAKER_TIMEOUT_MS = 60 * 1000;  // 60 seconds open window

// ─── Scheduled job advisory lock IDs ─────────────────────────────────────────────
// Each job uses a unique integer ID for PostgreSQL advisory locking.
// This prevents concurrent runs of the same job.
export const JOB_LOCK_REMINDER = 1;
export const JOB_LOCK_CODE_EXPIRY = 2;
export const JOB_LOCK_WEEKLY_DIGEST = 3;
export const JOB_LOCK_CLEANUP = 4;
export const JOB_LOCK_ORPHAN_FILE = 5;
export const JOB_LOCK_OUTBOX = 6;

// ─── Cleanup job safety guard ─────────────────────────────────────────────────────
export const CLEANUP_MAX_BATCH_SIZE = 50;  // Abort if more than 50 accounts match

// ─── Orphan file cleanup ──────────────────────────────────────────────────────────
export const ORPHAN_FILE_MIN_AGE_DAYS = 7;

// ─── Admin CSV export ─────────────────────────────────────────────────────────────
export const AUDIT_EXPORT_MAX_DAYS = 90;

// ─── Idempotency ─────────────────────────────────────────────────────────────────
export const IDEMPOTENCY_KEY_TTL_HOURS = 24;

// ─── Linking code ────────────────────────────────────────────────────────────────
export const LINKING_CODE_TTL_DAYS = 7;
export const LINKING_CODE_MAX_RETRIES = 3;

// ─── Health check ────────────────────────────────────────────────────────────────
export const HEALTH_CHECK_DB_TIMEOUT_MS = 2000;

// ─── Graceful shutdown ───────────────────────────────────────────────────────────
export const SHUTDOWN_DRAIN_TIMEOUT_MS = 5000;

// ─── Device info truncation ──────────────────────────────────────────────────────
export const DEVICE_INFO_MAX_LENGTH = 500;
