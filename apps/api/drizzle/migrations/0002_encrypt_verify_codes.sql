-- Migration: Widen email_verify_code from VARCHAR(6) to TEXT.
-- The application now encrypts OTPs at rest with AES-256-GCM before storage.
-- The encrypted output (~48 chars base64) exceeds the original 6-char limit.
ALTER TABLE users ALTER COLUMN email_verify_code TYPE TEXT;
