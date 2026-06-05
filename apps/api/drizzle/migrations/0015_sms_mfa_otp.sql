-- 0015_sms_mfa_otp.sql
--
-- Store SMS MFA fallback codes as short-lived one-time OTPs instead of
-- reusing the user's TOTP secret. Only the SHA-256 hash is stored.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sms_mfa_code_hash varchar(64),
  ADD COLUMN IF NOT EXISTS sms_mfa_expires_at timestamptz;