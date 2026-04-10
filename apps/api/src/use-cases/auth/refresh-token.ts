import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findRefreshTokenByHash,
  findUserCoreById,
  rotateRefreshTokenTransaction,
  revokeRefreshTokenFamily,
} from '../../db/queries/auth.queries';
import { hashToken, generateToken } from '../../utils/hash';
import { signAccessToken, refreshTokenExpiresAt } from '../../utils/jwt';
import { Sentry } from '../../config/sentry';

type Deps = Pick<Container, 'db' | 'logger'>;

export type RefreshTokenInput = {
  tokenValue: string;
  deviceInfo: string;
  ip: string | null;
};

export type RefreshTokenOutput = { accessToken: string; refreshTokenValue: string };

export async function execute(deps: Deps, input: RefreshTokenInput): Promise<RefreshTokenOutput> {
  const { db, logger } = deps;

  const tokenHash = hashToken(input.tokenValue);
  const stored = await findRefreshTokenByHash(db, tokenHash);
  if (!stored) {
    // Unknown token. Could be a forged value or one that was already pruned.
    throw new AppError(401, 'INVALID_TOKEN', 'Refresh token is invalid or expired.');
  }

  // Replay detection: a token whose `revoked_at` is set has already been
  // rotated. Anyone presenting it again is either the legitimate user with a
  // race condition (rare) or an attacker replaying a stolen token (the dangerous
  // case). We cannot distinguish, so we burn the entire family — every token
  // chained from the same login is invalidated, forcing both parties to re-login.
  if (stored.revoked_at !== null) {
    const burned = await revokeRefreshTokenFamily(db, stored.token_family);
    logger.warn(
      { userId: stored.user_id, tokenFamily: stored.token_family, burned, ip: input.ip },
      'refresh_token_replay_detected',
    );
    Sentry.captureMessage('Refresh token replay detected', {
      level: 'warning',
      tags: { userId: stored.user_id, tokenFamily: stored.token_family },
      extra: { burned, ip: input.ip ?? 'unknown', deviceInfo: input.deviceInfo },
    });
    throw new AppError(
      401,
      'TOKEN_REUSE_DETECTED',
      'Session security alert. Please log in again.',
    );
  }

  if (new Date() > stored.expires_at) {
    // Expired but not yet revoked: revoke the family for tidiness; not a breach.
    await revokeRefreshTokenFamily(db, stored.token_family);
    throw new AppError(401, 'TOKEN_EXPIRED', 'Refresh token has expired. Please log in again.');
  }

  const user = await findUserCoreById(db, stored.user_id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  // Generate new tokens before the transaction (CPU work outside DB).
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role as 'patient' | 'provider' | 'admin',
  });
  const newTokenValue = generateToken(64);
  const newTokenHash = hashToken(newTokenValue);

  // Atomic: revoke old token + insert new refresh token + session.
  // The conditional UPDATE inside the transaction is the second TOCTOU guard:
  // if a concurrent request already rotated this token, `rotated` is false and
  // we treat the current request as a replay too.
  const result = await rotateRefreshTokenTransaction(
    db, stored.id, user.id, newTokenHash, stored.token_family,
    input.deviceInfo, input.ip, refreshTokenExpiresAt(),
  );

  if (!result.rotated) {
    await revokeRefreshTokenFamily(db, stored.token_family);
    logger.warn(
      { userId: stored.user_id, tokenFamily: stored.token_family, ip: input.ip },
      'refresh_token_race_replay_detected',
    );
    Sentry.captureMessage('Refresh token race replay detected', {
      level: 'warning',
      tags: { userId: stored.user_id, tokenFamily: stored.token_family },
    });
    throw new AppError(
      401,
      'TOKEN_REUSE_DETECTED',
      'Session security alert. Please log in again.',
    );
  }

  return { accessToken, refreshTokenValue: newTokenValue };
}
