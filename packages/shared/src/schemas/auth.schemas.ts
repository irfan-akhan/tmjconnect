import { z } from 'zod';

// ─── Password policy ────────────────────────────────────────────────────────────
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must contain at least one digit')
  .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)');

// E.164: leading +, 8–15 digits, first digit non-zero. Required at signup so the
// number is usable for SMS MFA (Twilio) without a later collection step.
const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format, e.g. +15551234567');

// ─── Register (separate schemas per role — no discriminated union needed) ─────
export const registerPatientSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: phoneSchema,
  timezone: z.string().optional(),
});

export const registerProviderSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: phoneSchema,
  date_of_birth: z.string().date('Date of birth must be YYYY-MM-DD format'),
  timezone: z.string().optional(),
  license_number: z.string().min(1).max(100),
  license_type: z.string().min(1).max(100),
  specialty: z.string().min(1).max(100),
  clinic_name: z.string().min(1).max(200),
  credentials: z.array(z.string().max(100)).max(20).optional(),
});

/** @deprecated Use registerPatientSchema or registerProviderSchema directly. */
export const registerSchema = z.discriminatedUnion('role', [
  registerPatientSchema.extend({ role: z.literal('patient') }),
  registerProviderSchema.extend({ role: z.literal('provider') }),
]);

// ─── Verify Email ────────────────────────────────────────────────────────────────
export const verifyEmailSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

// ─── Login ────────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

// ─── MFA Setup ───────────────────────────────────────────────────────────────────
export const mfaVerifySetupSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

// ─── MFA Verify (login continuation) ────────────────────────────────────────────
export const mfaVerifySchema = z.object({
  mfa_token: z.string().min(1),
  code: z.string().min(6).max(10), // TOTP (6), SMS (6), backup code (10)
  type: z.enum(['totp', 'sms', 'backup']).default('totp'),
});

// ─── MFA SMS ─────────────────────────────────────────────────────────────────────
export const mfaSmsSchema = z.object({
  mfa_token: z.string().min(1),
});

// ─── Refresh ─────────────────────────────────────────────────────────────────────
export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// ─── Forgot Password ──────────────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

// ─── Reset Password ───────────────────────────────────────────────────────────────
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: passwordSchema,
});

export const resetPasswordVerifySchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const resetPasswordConfirmSchema = z.object({
  reset_token: z.string().min(1),
  new_password: passwordSchema,
});

// ─── Password-only schema for state-based reset token (mobile OTP flow) ────────
export const resetPasswordNewPasswordSchema = z.object({
  new_password: passwordSchema,
});

// ─── Resend Verify Email ──────────────────────────────────────────────────────────
export const resendVerifyEmailSchema = z.object({
  email: z.string().email().toLowerCase(),
});

// ─── Change Password ──────────────────────────────────────────────────────────────
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: passwordSchema,
});

// ─── Change Email ─────────────────────────────────────────────────────────────────
// Two-step flow: request emits a verification code to the NEW address; verify
// confirms the user controls it before we actually rotate the column.
export const requestEmailChangeSchema = z.object({
  new_email: z.string().email().toLowerCase(),
  current_password: z.string().min(1),
});

export const verifyEmailChangeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

// ─── TOS acceptance ──────────────────────────────────────────────────────────────
export const acceptTosSchema = z.object({
  version: z.string().min(1).max(10),
});

// ─── FCM Token ────────────────────────────────────────────────────────────────────
export const fcmTokenSchema = z.object({
  fcm_token: z.string().min(1).max(500),
});
