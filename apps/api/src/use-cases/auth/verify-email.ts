import type { Container } from '../../config/container';
import type { RateLimiterPostgres } from 'rate-limiter-flexible';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { AppError } from '../../middleware/errorHandler';
import {
  findUnverifiedUser,
  setEmailVerified,
  invalidateVerifyCode,
  findUserCoreById,
  getProfileFirstName,
} from '../../db/queries/auth.queries';
import { signMfaSetupToken } from '../../utils/jwt';
import { decryptVerifyCode } from '../../utils/hash';
import { issueTokens } from './helpers';

type Deps = Pick<Container, 'db' | 'email' | 'logger'> & {
  emailVerifyLimiter: RateLimiterPostgres;
};

export type VerifyEmailInput = { email: string; code: string };

export type VerifyEmailOutput =
  | { type: 'tokens'; accessToken: string; refreshTokenValue: string }
  | { type: 'mfa_setup'; setup_token: string };

export async function execute(deps: Deps, input: VerifyEmailInput): Promise<VerifyEmailOutput> {
  const { db, email, logger, emailVerifyLimiter } = deps;

  const user = await findUnverifiedUser(db, input.email);
  if (!user) throw new AppError(400, 'INVALID_CODE', 'Invalid or expired verification code.');
  if (!user.email_verify_code || !user.email_verify_expires) {
    throw new AppError(400, 'INVALID_CODE', 'Invalid or expired verification code.');
  }
  if (new Date() > user.email_verify_expires) {
    throw new AppError(400, 'CODE_EXPIRED', 'Verification code has expired. Please request a new one.');
  }

  // Decrypt the stored code before comparison.
  let storedCode: string;
  try {
    storedCode = decryptVerifyCode(user.email_verify_code);
  } catch {
    throw new AppError(400, 'INVALID_CODE', 'Invalid or expired verification code.');
  }

  if (storedCode !== input.code) {
    try {
      await emailVerifyLimiter.consume(input.email.toLowerCase());
    } catch (rlErr) {
      if (rlErr instanceof RateLimiterRes) {
        await invalidateVerifyCode(db, user.id);
        throw new AppError(
          429,
          'TOO_MANY_ATTEMPTS',
          'Too many incorrect attempts. Your verification code has been invalidated. Please request a new one.',
        );
      }
      throw rlErr;
    }
    throw new AppError(400, 'INVALID_CODE', 'Invalid verification code.');
  }

  emailVerifyLimiter.delete(input.email.toLowerCase()).catch(() => {});
  await setEmailVerified(db, user.id);

  const fullUser = await findUserCoreById(db, user.id);
  if (!fullUser) throw new AppError(500, 'INTERNAL', 'User not found after verification.');

  const firstName = await getProfileFirstName(db, user.id);
  email.sendWelcome(input.email, firstName ?? 'there')
    .catch((err) => logger.error({ err }, 'Failed to send welcome email'));

  if (user.role === 'patient') {
    const tokens = await issueTokens(db, fullUser, 'email-verify', null);
    return { type: 'tokens', ...tokens };
  }
  return { type: 'mfa_setup', setup_token: signMfaSetupToken(user.id) };
}
