// ─── User Roles ────────────────────────────────────────────────────────────────
export const ROLES = ['patient', 'provider', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// ─── Supported Countries ─────────────────────────────────────────────────────
export const SUPPORTED_COUNTRIES = ['US', 'CA', 'IN'] as const;
export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export const SUPPORTED_COUNTRY_LABELS: Record<SupportedCountry, string> = {
  US: 'United States',
  CA: 'Canada',
  IN: 'India',
};

// ─── Body Area Side ─────────────────────────────────────────────────────────────
// Where on the body a logged pain point sits. Two axes share one field:
//   lateral      — left / right / both / center
//   anterior-post— front / back  (e.g. front vs back of the neck)
// A zone is described on whichever axis distinguishes it, so a log may mix both.
export const BODY_AREA_SIDES = ['left', 'right', 'both', 'center', 'front', 'back'] as const;
export type BodyAreaSide = (typeof BODY_AREA_SIDES)[number];

/** Display labels. Sentence case for provider-facing views. */
export const BODY_AREA_SIDE_LABELS: Record<BodyAreaSide, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both sides',
  center: 'Center',
  front: 'Front',
  back: 'Back',
};

// ─── Report Urgency ─────────────────────────────────────────────────────────────
export const URGENCY_LEVELS = ['routine', 'concerning', 'urgent'] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

// ─── Report Status ──────────────────────────────────────────────────────────────
export const REPORT_STATUSES = ['submitted', 'viewed', 'reviewed', 'responded'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

// ─── Assignment Status ──────────────────────────────────────────────────────────
export const ASSIGNMENT_STATUSES = ['active', 'paused', 'completed'] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// ─── Linking Code Status ────────────────────────────────────────────────────────
export const LINKING_CODE_STATUSES = ['pending', 'connected', 'expired'] as const;
export type LinkingCodeStatus = (typeof LINKING_CODE_STATUSES)[number];

// ─── Reminder Type ──────────────────────────────────────────────────────────────
export const REMINDER_TYPES = ['exercise', 'symptom'] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

// ─── Email Digest Frequency ─────────────────────────────────────────────────────
export const DIGEST_FREQUENCIES = ['instant', 'daily', 'weekly', 'off'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

// ─── Notification Types ─────────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
  'exercise_reminder',
  'symptom_checkin',
  'provider_message',
  'report_submitted',
  'report_urgent',
  'report_reviewed',
  'exercise_assigned',
  'link_accepted',
  'welcome',
  'password_reset',
  'mfa_code',
  'new_device_login',
  'weekly_summary',
  'account_locked',
  'streak_milestone',
  'report_requested',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ─── Patient Activity Actions ─────────────────────────────────────────────────
export const PATIENT_ACTIVITY_ACTIONS = [
  'auth.login.success',
  'auth.login.failed',
  'auth.logout',
  'auth.password_reset',
  'auth.change_password',
  'auth.mfa_enabled',
  'auth.mfa_disabled',
  'auth.email_change_requested',
  'auth.email_change_verified',
  'session_revoked',
  'linking_code_accepted',
  'link_disconnected',
] as const;
export type PatientActivityAction = (typeof PATIENT_ACTIVITY_ACTIONS)[number];

// ─── Reminder Days ───────────────────────────────────────────────────────────────
export const REMINDER_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

// ─── AI Clinical Reports ───────────────────────────────────────────────────────────
export const AI_REPORT_TYPES = ['progress', 'treatment_summary'] as const;
export type AiReportType = (typeof AI_REPORT_TYPES)[number];

export const AI_REPORT_STATUSES = ['draft', 'approved'] as const;
export type AiReportStatus = (typeof AI_REPORT_STATUSES)[number];

export const AI_REPORT_PROVIDER_OUTCOMES = [
  'approved',
  'discarded',
  'edited_then_approved',
] as const;
export type AiReportProviderOutcome = (typeof AI_REPORT_PROVIDER_OUTCOMES)[number];

export const AI_REPORT_DISCARD_REASONS = [
  'clinically_inaccurate',
  'missing_information',
  'wrong_tone',
  'formatting_issues',
  'not_useful',
  'other',
] as const;
export type AiReportDiscardReason = (typeof AI_REPORT_DISCARD_REASONS)[number];

export const AI_REPORT_TREND_DIRECTIONS = ['improving', 'worsening', 'stable'] as const;
export type AiReportTrendDirection = (typeof AI_REPORT_TREND_DIRECTIONS)[number];

/** Anthropic model used for clinical report drafting. */
export const AI_REPORT_MODEL = 'claude-sonnet-4-6';
/** Per-provider generation rate limit (per rolling hour). */
export const AI_REPORT_RATE_LIMIT_PER_HOUR = 20;

// ─── Diagnostic data-sufficiency thresholds (CLINICAL — pending DDS/DMD sign-off) ────
// These gate whether the AI offers a DC/TMD diagnostic impression vs. an explicit
// "insufficient data" statement. They are surfaced here as named constants so the
// medical founder can tune them in one place. The prompt interpolates
// AI_REPORT_MIN_LOGGING_DAYS; the data collector uses AI_REPORT_DATA_GAP_MISSING_THRESHOLD.

/** Minimum days-with-logs in the period before the AI may offer a diagnostic impression. */
export const AI_REPORT_MIN_LOGGING_DAYS = 7;
/**
 * Fraction of days in the period with no symptom log above which the period is flagged
 * as a data gap (dataGapFlag). 0.3 = "more than 30% of days missing".
 */
export const AI_REPORT_DATA_GAP_MISSING_THRESHOLD = 0.3;

// ─── Pagination ──────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

// ─── API ─────────────────────────────────────────────────────────────────────────
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
