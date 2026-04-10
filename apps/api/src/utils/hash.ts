import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, createCipheriv, createDecipheriv } from 'crypto';
import { BCRYPT_ROUNDS, VERIFY_CODE_MIN, VERIFY_CODE_MAX } from '../config/constants';
import { env } from '../config/env';

// ─── Password hashing ─────────────────────────────────────────────────────────────

/** Hashes a plaintext password with bcrypt (12 rounds). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compares a plaintext password against a bcrypt hash. */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Dummy bcrypt comparison for timing-attack prevention.
 * Called on the user-not-found path in login to consume the same time as a real comparison.
 * This prevents timing-based account enumeration.
 */
const DUMMY_HASH = '$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnn';
export async function dummyPasswordCompare(): Promise<void> {
  await bcrypt.compare('dummy', DUMMY_HASH).catch(() => {/* expected */});
}

// ─── Token hashing ────────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a token.
 * Used for storing refresh tokens and password reset tokens:
 * plaintext transmitted once, only the hash stored in the DB.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generates a cryptographically random hex token of the given byte length. */
export function generateToken(byteLength: number): string {
  return randomBytes(byteLength).toString('hex');
}

// ─── 6-digit verification code ────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 6-digit email verification code.
 * Code space: 900,000 values (100000–999999).
 * With 5-attempt lockout: 5/900,000 = 0.00056% chance per issuance.
 */
export function generateVerifyCode(): string {
  return randomInt(VERIFY_CODE_MIN, VERIFY_CODE_MAX + 1).toString();
}

// ─── MFA backup codes ─────────────────────────────────────────────────────────────

/** Generates 10 one-time backup codes (10 chars each, hex). */
export function generateBackupCodes(count: number): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString('hex'));
}

/** Hashes a backup code with bcrypt (same rounds as password). */
export async function hashBackupCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

/** Compares a submitted backup code against a bcrypt hash. */
export async function compareBackupCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

// ─── MFA secret encryption (AES-256-GCM) ─────────────────────────────────────────
// TOTP secrets are encrypted at the application level before storage.
// This is in addition to database-at-rest encryption.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a TOTP secret using AES-256-GCM with MFA_ENCRYPTION_KEY.
 * Returns a base64-encoded string containing: IV + ciphertext + auth tag.
 */
export function encryptMfaSecret(plaintext: string): string {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Concatenate IV + ciphertext + auth tag and base64-encode.
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypts a TOTP secret encrypted by encryptMfaSecret().
 * Returns the plaintext secret, or throws if decryption fails.
 */
export function decryptMfaSecret(ciphertext: string): string {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');
  const buf = Buffer.from(ciphertext, 'base64');

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── Email verification code encryption (AES-256-GCM) ─────────────────────────────
// OTPs are encrypted at the application level before DB storage.
// Same key and algorithm as MFA secrets — defence-in-depth against DB read compromise.

/**
 * Encrypts a 6-digit email verification code using AES-256-GCM.
 * Returns a base64-encoded string containing: IV + ciphertext + auth tag.
 */
export function encryptVerifyCode(code: string): string {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/**
 * Decrypts an email verification code encrypted by encryptVerifyCode().
 * Returns the plaintext 6-digit code, or throws if decryption fails.
 */
export function decryptVerifyCode(ciphertext: string): string {
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex');
  const buf = Buffer.from(ciphertext, 'base64');

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── Linking code generation ───────────────────────────────────────────────────────

const LINKING_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Generates a random 6-character alphanumeric linking code (uppercase). */
export function generateLinkingCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += LINKING_CODE_CHARS[randomInt(0, LINKING_CODE_CHARS.length)];
  }
  return code;
}
