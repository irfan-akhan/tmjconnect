/**
 * Typed wrappers for /auth/* endpoints. Shapes verified against
 * apps/api/src/routes/auth.ts and packages/shared/src/schemas/auth.schemas.ts.
 * If a route changes, update both the schema import AND the response type here.
 */

import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterPatientInput,
  ResendVerifyEmailInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@tmjconnect/shared';
import { api } from './api';

export type TokenPair = { access_token: string; refresh_token: string };

export type LoginResponse =
  | { type: 'tokens'; access_token: string; refresh_token: string }
  | { type: 'mfa'; mfa_required: true; mfa_token: string };

export type VerifyEmailResponse =
  | { type: 'tokens'; access_token: string; refresh_token: string }
  | { type: 'mfa_setup'; mfa_setup_required: true; setup_token: string };

export async function registerPatient(input: RegisterPatientInput): Promise<{ message: string }> {
  return api.post('/auth/patient/register', input, { skipAuth: true });
}

export async function loginPatient(input: LoginInput): Promise<LoginResponse> {
  const raw = await api.post<
    | { access_token: string; refresh_token: string }
    | { mfa_required: true; mfa_token: string }
  >('/auth/patient/login', input, { skipAuth: true });
  if ('access_token' in raw) {
    return { type: 'tokens', access_token: raw.access_token, refresh_token: raw.refresh_token };
  }
  return { type: 'mfa', mfa_required: true, mfa_token: raw.mfa_token };
}

export async function verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResponse> {
  const raw = await api.post<
    | { access_token: string; refresh_token: string }
    | { mfa_setup_required: true; setup_token: string }
  >('/auth/verify-email', input, { skipAuth: true });
  if ('access_token' in raw) {
    return { type: 'tokens', access_token: raw.access_token, refresh_token: raw.refresh_token };
  }
  return { type: 'mfa_setup', mfa_setup_required: true, setup_token: raw.setup_token };
}

export async function resendVerifyEmail(input: ResendVerifyEmailInput): Promise<{ message: string }> {
  return api.post('/auth/resend-verify-email', input, { skipAuth: true });
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
  return api.post('/auth/forgot-password', input, { skipAuth: true });
}

export async function resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
  return api.post('/auth/reset-password', input, { skipAuth: true });
}

export async function logout(refreshToken: string | null): Promise<void> {
  await api.delete('/auth/logout', refreshToken ? { refresh_token: refreshToken } : undefined);
}

export async function updateFcmToken(fcmToken: string): Promise<void> {
  await api.patch('/auth/fcm-token', { fcm_token: fcmToken });
}
