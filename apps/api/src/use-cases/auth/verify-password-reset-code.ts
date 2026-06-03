import type { Container } from '../../config/container';
import type { RateLimiterPostgres } from 'rate-limiter-flexible';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { AppError } from '../../middleware/errorHandler';
import {
  findUserByEmailActive,
  findLatestActivePasswordResetByUserId,
  rotatePasswordResetToSessionToken,
} from '../../db/queries/auth.queries';
import { generateToken, hashToken } from '../../utils/hash';
import { PASSWORD_RESET_SESSION_TTL_SECONDS, PASSWORD_RESET_TOKEN_BYTE_LENGTH } from '../../config/constants';

type Deps = Pick<Container, 'db'> & {
  passwordResetVerifyLimiter: RateLimiterPostgres;
};

export type VerifyPasswordResetCodeInput = {
  email: string;
  code: string;
};

export type VerifyPasswordResetCodeOutput = {
  reset_token: string;
};

export async function execute(
  deps: Deps,
  input: VerifyPasswordResetCodeInput,
): Promise<VerifyPasswordResetCodeOutput> {
  const { db, passwordResetVerifyLimiter } = deps;

  const user = await findUserByEmailActive(db, input.email);
  if (!user) {
    throw new AppError(400, 'INVALID_CODE', 'Reset code is invalid or expired.');
  }

  const reset = await findLatestActivePasswordResetByUserId(db, user.id);
  if (!reset || new Date() > reset.expires_at) {
    throw new AppError(400, 'INVALID_CODE', 'Reset code is invalid or expired.');
  }

  const submittedHash = hashToken(input.code);
  const emailKey = input.email.toLowerCase();

  if (submittedHash !== reset.token_hash) {
    try {
      await passwordResetVerifyLimiter.consume(emailKey);
    } catch (rlErr) {
      if (rlErr instanceof RateLimiterRes) {
        throw new AppError(
          429,
          'TOO_MANY_ATTEMPTS',
          'Too many incorrect reset code attempts. Please request a new code.',
        );
      }
      throw rlErr;
    }
    throw new AppError(400, 'INVALID_CODE', 'Reset code is invalid or expired.');
  }

  passwordResetVerifyLimiter.delete(emailKey).catch(() => {});

  const resetToken = generateToken(PASSWORD_RESET_TOKEN_BYTE_LENGTH);
  const resetTokenHash = hashToken(resetToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_SESSION_TTL_SECONDS * 1000);

  await rotatePasswordResetToSessionToken(db, reset.id, resetTokenHash, expiresAt);

  return { reset_token: resetToken };
}
