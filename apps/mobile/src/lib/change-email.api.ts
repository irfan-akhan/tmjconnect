import { api } from './api';

export type RequestEmailChangeResult = {
  message?: string;
  /** The new email the code was sent to — echoed for confirmation. */
  pending_email?: string;
};

export async function requestEmailChange(
  newEmail: string,
  currentPassword: string,
): Promise<RequestEmailChangeResult> {
  const res = await api.post<{ data?: RequestEmailChangeResult } & RequestEmailChangeResult>(
    '/auth/change-email/request',
    { new_email: newEmail, current_password: currentPassword },
  );
  return res.data ?? res;
}

export async function verifyEmailChange(code: string): Promise<{ email?: string }> {
  const res = await api.post<{ data?: { email?: string } }>(
    '/auth/change-email/verify',
    { code },
  );
  return res.data ?? {};
}
