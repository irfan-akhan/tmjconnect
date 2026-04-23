import { api } from './api';

export type MfaSetupResult = {
  /** otpauth://... URL suitable for QR encoding. */
  otpauth_url: string;
  /** Base-32 secret, for manual entry. */
  secret: string;
};

export type MfaVerifySetupResult = {
  message: string;
  backup_codes: string[];
  access_token: string;
  refresh_token: string;
};

export async function initPatientMfa(): Promise<{ setup_token: string }> {
  return api.post<{ setup_token: string }>('/auth/patient/mfa/init');
}

export async function setupMfa(setupToken: string): Promise<MfaSetupResult> {
  return api.post<MfaSetupResult>('/auth/mfa/setup', undefined, { authToken: setupToken });
}

export async function verifyMfaSetup(
  setupToken: string,
  code: string,
): Promise<MfaVerifySetupResult> {
  return api.post<MfaVerifySetupResult>(
    '/auth/mfa/verify-setup',
    { code },
    { authToken: setupToken },
  );
}

export async function verifyMfaLogin(
  mfaToken: string,
  code: string,
  type: 'totp' | 'sms' | 'backup' = 'totp',
): Promise<{ access_token: string; refresh_token: string }> {
  return api.post('/auth/mfa/verify', { mfa_token: mfaToken, code, type }, { skipAuth: true });
}

export async function sendMfaSms(mfaToken: string): Promise<void> {
  await api.post('/auth/mfa/sms', { mfa_token: mfaToken }, { skipAuth: true });
}

export async function disablePatientMfa(password: string): Promise<void> {
  await api.delete('/auth/patient/mfa', { password });
}
