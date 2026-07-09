// ⚠️ TEST-ONLY — REMOVE AFTER TESTING.
//
// Master-OTP bypass for the provider login MFA step. When TEST_MASTER_OTP is
// set in the environment, testers can submit that value at the `POST /mfa/verify`
// step instead of a real TOTP/SMS/backup code and be treated as verified.
//
// Safety: this is HARD-DISABLED in production. `isMasterOtp` returns false
// whenever APP_ENV === 'production', regardless of whether TEST_MASTER_OTP is
// set, and env.ts additionally refuses to boot if the var is set in prod.
//
// To fully remove: delete this file, drop TEST_MASTER_OTP from env.ts, and
// remove the `isMasterOtp(...)` short-circuit in verify-mfa.ts.
import { env } from '../../config/env';

export function isMasterOtp(code: string): boolean {
  if (env.APP_ENV === 'production') return false;
  if (!env.TEST_MASTER_OTP) return false;
  return code === env.TEST_MASTER_OTP;
}
