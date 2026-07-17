import { z } from 'zod';
import {
  registerPatientSchema,
  registerProviderSchema,
  verifyEmailSchema,
  loginSchema,
  accountRestoreRequestSchema,
  mfaVerifySchema,
  mfaVerifySetupSchema,
  mfaReconfigureInitSchema,
  mfaSmsSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordVerifySchema,
  resetPasswordConfirmSchema,
  changePasswordSchema,
  resendVerifyEmailSchema,
  fcmTokenSchema,
} from '../schemas/auth.schemas';
import {
  updatePatientProfileSchema,
  createSymptomLogSchema,
  updateSymptomLogSchema,
  createReportSchema,
  createReminderSchema,
  updateReminderSchema,
} from '../schemas/patients.schemas';
import {
  updateProviderProfileSchema,
  emailInviteSchema,
} from '../schemas/providers.schemas';
import {
  createExerciseSchema,
  updateExerciseSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from '../schemas/exercises.schemas';
import { respondToReportSchema } from '../schemas/reports.schemas';
import {
  generateAiReportSchema,
  editAiReportSchema,
  discardAiReportSchema,
  aiReportPatientListQuerySchema,
  reportContentSchema,
  reportSectionsSchema,
  treatmentSummarySectionsSchema,
} from '../schemas/ai-reports.schemas';
import { acceptLinkingCodeSchema } from '../schemas/linking.schemas';
import { adminUpdateUserSchema } from '../schemas/admin.schemas';
import type {
  AiReportType,
  AiReportStatus,
  AiReportProviderOutcome,
  AiReportDiscardReason,
  AiReportTrendDirection,
} from '../constants';

// ─── Auth Types ───────────────────────────────────────────────────────────────────
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type RegisterProviderInput = z.infer<typeof registerProviderSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountRestoreRequestInput = z.infer<typeof accountRestoreRequestSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaVerifySetupInput = z.infer<typeof mfaVerifySetupSchema>;
export type MfaReconfigureInitInput = z.infer<typeof mfaReconfigureInitSchema>;
export type MfaSmsInput = z.infer<typeof mfaSmsSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordVerifyInput = z.infer<typeof resetPasswordVerifySchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResendVerifyEmailInput = z.infer<typeof resendVerifyEmailSchema>;
export type FcmTokenInput = z.infer<typeof fcmTokenSchema>;

// ─── Patient Types ────────────────────────────────────────────────────────────────
export type UpdatePatientProfileInput = z.infer<typeof updatePatientProfileSchema>;
export type CreateSymptomLogInput = z.infer<typeof createSymptomLogSchema>;
export type UpdateSymptomLogInput = z.infer<typeof updateSymptomLogSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

// ─── Provider Types ───────────────────────────────────────────────────────────────
export type UpdateProviderProfileInput = z.infer<typeof updateProviderProfileSchema>;
export type EmailInviteInput = z.infer<typeof emailInviteSchema>;

// ─── Exercise Types ───────────────────────────────────────────────────────────────
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

// ─── Report Types ─────────────────────────────────────────────────────────────────
export type RespondToReportInput = z.infer<typeof respondToReportSchema>;

// ─── AI Clinical Report Types ───────────────────────────────────────────────────────
export type GenerateAiReportInput = z.infer<typeof generateAiReportSchema>;
export type EditAiReportInput = z.infer<typeof editAiReportSchema>;
export type DiscardAiReportInput = z.infer<typeof discardAiReportSchema>;
export type AiReportPatientListQuery = z.infer<typeof aiReportPatientListQuerySchema>;
export type AiReportSections = z.infer<typeof reportSectionsSchema>;
export type AiTreatmentSummarySections = z.infer<typeof treatmentSummarySectionsSchema>;
export type AiReportContent = z.infer<typeof reportContentSchema>;

/**
 * Aggregated patient data sent to Claude as the user message. Server-constructed by
 * the data collector — never received from a client. Exercise adherence is reported as
 * raw counts only (no computed percentage); the model describes adherence qualitatively.
 */
export interface WeeklyPainSummary {
  weekStart: string;
  averageNRS: number;
  logCount: number;
}

export interface ExerciseAdherenceSummary {
  exerciseTitle: string;
  category: string | null;
  frequencyLabel: string;
  actualCompletions: number;
  activeDaysInRange: number;
}

/**
 * Deterministically computed by the data collector (NOT the model). The prompt treats
 * this as authoritative: the model renders a diagnostic impression iff `sufficient` is
 * true, and otherwise states insufficiency and lists `missing`. Removes any guesswork
 * about whether the data supports a diagnosis.
 */
export interface DiagnosticReadiness {
  sufficient: boolean;
  loggingDays: number;
  minLoggingDays: number;
  checks: {
    enoughLoggingDays: boolean;
    noDataGap: boolean;
    hasPainLocations: boolean;
    hasPainCharacterization: boolean;
    hasNrsData: boolean;
  };
  /** Human-readable list of what is missing. Empty when `sufficient` is true. */
  missing: string[];
}

export interface PatientDataPayload {
  patient: { fullName: string; age: number | null };
  provider: { fullName: string; credentialType: string; clinicName: string };
  diagnosticReadiness: DiagnosticReadiness;
  reportPeriod: {
    start: string;
    end: string;
    totalDays: number;
    daysWithLogs: number;
    dataGapFlag: boolean;
  };
  painSummary: {
    averageNRS: number;
    minNRS: number;
    maxNRS: number;
    trendDirection: AiReportTrendDirection;
    weeklyBreakdown: WeeklyPainSummary[];
    topLocations: string[];
    topPainTypes: string[];
    topTriggers: string[];
    recentPatientNotes: string[];
  };
  exerciseSummary: {
    exercises: ExerciseAdherenceSummary[];
    totalCompletions: number;
  };
  reportsSummary: {
    totalReports: number;
    byUrgency: { routine: number; concerning: number; urgent: number };
    significantProviderResponses: string[];
  };
}

/** Row shape for the per-patient report list (provider). */
export interface AiReportListItem {
  id: string;
  report_type: AiReportType;
  date_range_start: string;
  date_range_end: string;
  status: AiReportStatus;
  created_at: string;
  approved_at: string | null;
  provider_outcome: AiReportProviderOutcome | null;
  red_flags_detected: boolean;
}

/** Full report returned to the provider (edited_content if present, else generated_content). */
export interface AiReportDetail {
  id: string;
  patient_id: string;
  report_type: AiReportType;
  status: AiReportStatus;
  date_range_start: string;
  date_range_end: string;
  content: AiReportContent;
  red_flags_detected: boolean;
  provider_outcome: AiReportProviderOutcome | null;
  created_at: string;
  approved_at: string | null;
  pdf_available: boolean;
}

/** Response from POST /ai-reports/generate. */
export interface GenerateAiReportResponse {
  reportId: string;
  content: AiReportContent;
  status: 'draft';
  redFlagsDetected: boolean;
}

// ─── Admin AI-report observability DTOs ─────────────────────────────────────────────

/** Row in the admin AI-reports list. Excludes prompt/input/output snapshots. */
export interface AdminAiReportListItem {
  id: string;
  report_type: AiReportType;
  status: AiReportStatus;
  provider_outcome: AiReportProviderOutcome | null;
  discard_reason: AiReportDiscardReason | null;
  red_flags_detected: boolean;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  generation_latency_ms: number | null;
  edit_distance_score: number | null;
  created_at: string;
  approved_at: string | null;
  provider_outcome_at: string | null;
  provider: { id: string | null; fullName: string | null; clinicName: string | null };
  patient: { id: string; fullName: string | null };
}

/** Full admin detail view — includes all snapshots. */
export interface AdminAiReportDetail {
  id: string;
  report_type: AiReportType;
  status: AiReportStatus;
  date_range_start: string;
  date_range_end: string;
  red_flags_detected: boolean;
  provider_outcome: AiReportProviderOutcome | null;
  provider_outcome_at: string | null;
  discard_reason: AiReportDiscardReason | null;
  discard_notes: string | null;
  edit_distance_score: number | null;
  model_used: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  generation_latency_ms: number | null;
  created_at: string;
  approved_at: string | null;
  pdf_available: boolean;
  provider: {
    id: string | null;
    fullName: string | null;
    credentialType: string | null;
    clinicName: string | null;
  };
  patient: { id: string; fullName: string | null; age: number | null };
  prompt_snapshot: string | null;
  input_snapshot: PatientDataPayload | null;
  output_snapshot: AiReportContent | null;
  generated_content: AiReportContent;
  edited_content: AiReportContent | null;
}

export interface AiReportAnalytics {
  totalReports: number;
  byOutcome: { approved: number; editedThenApproved: number; discarded: number; pending: number };
  acceptanceRate: number;
  editRate: number;
  discardRate: number;
  avgEditDistanceScore: number;
  discardReasonBreakdown: Record<AiReportDiscardReason, number>;
  avgGenerationLatencyMs: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  redFlagDetectionCount: number;
  byReportType: {
    progress: { total: number; acceptanceRate: number };
    treatment_summary: { total: number; acceptanceRate: number };
  };
  last30Days: {
    totalReports: number;
    acceptanceRate: number;
    discardRate: number;
    avgEditDistanceScore: number;
  };
}

export interface AiReportTrendPoint {
  periodStart: string;
  totalReports: number;
  approved: number;
  discarded: number;
  editedThenApproved: number;
  acceptanceRate: number;
  avgEditDistanceScore: number;
}

// ─── Linking Types ────────────────────────────────────────────────────────────────
export type AcceptLinkingCodeInput = z.infer<typeof acceptLinkingCodeSchema>;

// ─── Admin Types ──────────────────────────────────────────────────────────────────
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

// ─── API Response Types ───────────────────────────────────────────────────────────

/** Standard paginated list response (offset-based). */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

/** Cursor-based paginated response (for infinite scroll: symptom logs, notifications). */
export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

/** Standard API error response shape. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** JWT access token payload. */
export interface TokenPayload {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'admin';
  // Opaque session identifier = the login's refresh-token family. Lets the server
  // mark which listed session is the caller's current one. Not a credential.
  sid?: string;
  iat?: number;
  exp?: number;
}
