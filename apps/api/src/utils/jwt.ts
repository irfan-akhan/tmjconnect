import jwt from 'jsonwebtoken';
import type { TokenPayload } from '@tmjconnect/shared';
import { env } from '../config/env';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  MFA_TOKEN_TTL_SECONDS,
  MFA_SETUP_TOKEN_TTL_SECONDS,
} from '../config/constants';

/**
 * Signs a short-lived access token (15 minutes).
 * Payload: { id, email, role }
 */
export function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Signs a refresh token JWT wrapper (used to sign the opaque token family — not stored).
 * The actual refresh token is a random 64-byte hex string stored hashed in the DB.
 * This JWT is used internally to associate the token with a family+user on rotation.
 *
 * Note: Refresh tokens are opaque hex strings. This function is for signing the
 * short-lived MFA token, not for the opaque refresh token itself.
 */
export function signMfaToken(userId: string): string {
  return jwt.sign(
    { id: userId, purpose: 'mfa' },
    env.JWT_SECRET,
    { expiresIn: MFA_TOKEN_TTL_SECONDS },
  );
}

/**
 * Signs a short-lived MFA setup token (10 minutes).
 * Issued after email verification for providers who have not yet set up TOTP.
 */
export function signMfaSetupToken(userId: string): string {
  return jwt.sign(
    { id: userId, purpose: 'mfa_setup' },
    env.JWT_SECRET,
    { expiresIn: MFA_SETUP_TOKEN_TTL_SECONDS },
  );
}

/**
 * Tries each candidate secret in turn and returns the first successful decode.
 * Used to support seamless key rotation: during a rotation window, JWT_SECRET
 * is the new key and JWT_SECRET_PREVIOUS is the old one. Both are accepted
 * until the previous-key window expires.
 *
 * Order matters — try the current key first so the common path is fast.
 */
function tryVerify<T = unknown>(token: string, secrets: Array<string | undefined>): T | null {
  for (const secret of secrets) {
    if (!secret) continue;
    try {
      return jwt.verify(token, secret) as T;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

/**
 * Verifies a JWT and returns the decoded payload, or null if invalid/expired.
 * Accepts tokens signed with either JWT_SECRET (current) or JWT_SECRET_PREVIOUS
 * (during a rotation window).
 * Never throws — returns null on any failure.
 */
export function verifyToken(token: string): TokenPayload | null {
  const decoded = tryVerify<TokenPayload | string>(token, [env.JWT_SECRET, env.JWT_SECRET_PREVIOUS]);
  if (decoded && typeof decoded === 'object' && 'id' in decoded) {
    return decoded as TokenPayload;
  }
  return null;
}

/**
 * Verifies a purpose-specific token (MFA or MFA setup).
 * Returns the userId if valid, null otherwise.
 * Also accepts the previous JWT secret during rotation.
 */
export function verifyPurposeToken(
  token: string,
  purpose: 'mfa' | 'mfa_setup',
): string | null {
  const decoded = tryVerify<{ id: string; purpose: string }>(token, [
    env.JWT_SECRET,
    env.JWT_SECRET_PREVIOUS,
  ]);
  if (!decoded || decoded.purpose !== purpose) return null;
  return decoded.id;
}

/** Returns when the refresh token should expire (7 days from now). */
export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
