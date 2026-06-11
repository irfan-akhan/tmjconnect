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

// ─── Reminder Days ───────────────────────────────────────────────────────────────
export const REMINDER_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

// ─── Pagination ──────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

// ─── API ─────────────────────────────────────────────────────────────────────────
export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
