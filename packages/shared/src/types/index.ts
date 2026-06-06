import { z } from 'zod';
import {
  registerPatientSchema,
  registerProviderSchema,
  verifyEmailSchema,
  loginSchema,
  accountRestoreRequestSchema,
  mfaVerifySchema,
  mfaVerifySetupSchema,
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
import { acceptLinkingCodeSchema } from '../schemas/linking.schemas';
import { adminUpdateUserSchema } from '../schemas/admin.schemas';

// ─── Auth Types ───────────────────────────────────────────────────────────────────
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;
export type RegisterProviderInput = z.infer<typeof registerProviderSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountRestoreRequestInput = z.infer<typeof accountRestoreRequestSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type MfaVerifySetupInput = z.infer<typeof mfaVerifySetupSchema>;
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
  iat?: number;
  exp?: number;
}
