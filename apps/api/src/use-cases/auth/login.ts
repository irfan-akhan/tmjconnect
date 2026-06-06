import type { Container } from '../../config/container';
import type { RateLimiterPostgres } from 'rate-limiter-flexible';
import { RateLimiterRes } from 'rate-limiter-flexible';
import { AppError } from '../../middleware/errorHandler';
import {
  findUserForLogin,
  insertLoginEvent,
  getProfileFirstName,
  restoreSoftDeletedUser,
} from '../../db/queries/auth.queries';
import { comparePassword, dummyPasswordCompare } from '../../utils/hash';
import { signMfaToken } from '../../utils/jwt';
import { issueTokens, checkNewDevice } from './helpers';

type Deps = Pick<Container, 'db' | 'email' | 'logger'> & {
  loginLimiter: RateLimiterPostgres;
};

const SOFT_DELETE_LOGIN_GRACE_MS = 24 * 60 * 60 * 1000;

export type LoginInput = {
  role: 'patient' | 'provider' | 'admin';
  email: string;
  password: string;
  ip: string | null;
  deviceInfo: string;
};

export type LoginOutput =
  | { type: 'tokens'; accessToken: string; refreshTokenValue: string }
  | { type: 'mfa_required'; mfa_token: string };

export async function execute(deps: Deps, input: LoginInput): Promise<LoginOutput> {
  const { db, email, logger, loginLimiter } = deps;

  // Debug logging at every major branch so production "I can't log in" tickets
  // are debuggable from logs alone (no need to attach a debugger or read code).
  // None of these logs include passwords, hashes, or tokens — only flow markers.
  logger.debug({ role: input.role, ip: input.ip }, 'login: start');

  const user = await findUserForLogin(db, input.email);
  if (!user) {
    await dummyPasswordCompare();
    logger.debug({ role: input.role }, 'login: rejected — unknown email');
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  logger.debug({ userId: user.id, role: user.role }, 'login: user found');

  const lockStatus = await loginLimiter.get(input.email.toLowerCase());
  if (lockStatus !== null && lockStatus.remainingPoints <= 0) {
    const retryMinutes = Math.ceil(lockStatus.msBeforeNext / 60_000);
    logger.debug({ userId: user.id, retryMinutes }, 'login: rejected — account locked');
    throw new AppError(
      429,
      'ACCOUNT_LOCKED',
      `Account temporarily locked. Try again in ${retryMinutes} minute${retryMinutes === 1 ? '' : 's'}.`,
    );
  }

  const passwordMatch = await comparePassword(input.password, user.password_hash);

  if (!passwordMatch) {
    logger.debug({ userId: user.id }, 'login: password mismatch');
    await insertLoginEvent(db, {
      user_id: user.id,
      email: input.email.toLowerCase(),
      success: false,
      ip_address: input.ip,
      device_info: input.deviceInfo,
      failure_reason: 'invalid_password',
    });

    try {
      await loginLimiter.consume(input.email.toLowerCase());
    } catch (rlErr) {
      if (rlErr instanceof RateLimiterRes) {
        void (async () => {
          try {
            const firstName = await getProfileFirstName(db, user.id);
            await email.sendAccountLocked(user.email, firstName ?? 'there');
          } catch (e) {
            logger.error({ err: e }, 'Failed to send account locked email');
          }
        })();
        throw new AppError(
          429,
          'ACCOUNT_LOCKED',
          'Account locked due to too many failed login attempts. Try again in 30 minutes.',
        );
      }
      throw rlErr;
    }

    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  loginLimiter.delete(input.email.toLowerCase()).catch(() => {});
  logger.debug({ userId: user.id }, 'login: password verified');

  if (user.role !== input.role) {
    logger.debug({ userId: user.id, actualRole: user.role, expectedRole: input.role }, 'login: rejected — wrong portal');
    const portal = input.role === 'patient' ? 'patient' : input.role === 'admin' ? 'admin' : 'provider';
    throw new AppError(403, 'WRONG_PORTAL', `This account is not a ${portal} account.`);
  }

  if (user.deleted_at) {
    const deletedAt = new Date(user.deleted_at).getTime();
    const withinGracePeriod = Number.isFinite(deletedAt) && Date.now() - deletedAt <= SOFT_DELETE_LOGIN_GRACE_MS;

    if (!withinGracePeriod) {
      logger.debug({ userId: user.id }, 'login: rejected — deleted account outside restore window');
      await insertLoginEvent(db, {
        user_id: user.id,
        email: user.email,
        success: false,
        ip_address: input.ip,
        device_info: input.deviceInfo,
        failure_reason: 'account_deleted',
      });
      throw new AppError(403, 'ACCOUNT_DELETED', 'This account is no longer available. Contact support.');
    }

    await restoreSoftDeletedUser(db, user.id);
    logger.info({ userId: user.id }, 'login: soft-deleted account restored within grace period');
  }

  if (!user.email_verified) {
    logger.debug({ userId: user.id }, 'login: rejected — email not verified');
    throw new AppError(403, 'VERIFY_EMAIL', 'Please verify your email address before logging in.');
  }
  if (!user.is_active) {
    logger.debug({ userId: user.id }, 'login: rejected — account inactive');
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Your account has been deactivated. Contact support.');
  }

  await insertLoginEvent(db, {
    user_id: user.id,
    email: user.email,
    success: true,
    ip_address: input.ip,
    device_info: input.deviceInfo,
  });

  // Patient flow: tokens directly, or MFA if patient opted in.
  if (input.role === 'patient') {
    if (user.mfa_enabled) {
      logger.debug({ userId: user.id }, 'login: patient mfa required, issuing mfa_token');
      return { type: 'mfa_required', mfa_token: signMfaToken(user.id) };
    }
    const tokens = await issueTokens(db, user, input.deviceInfo, input.ip);
    checkNewDevice(db, email, logger, user.id, user.email, input.ip ?? '', input.deviceInfo);
    logger.debug({ userId: user.id }, 'login: patient tokens issued');
    return { type: 'tokens', ...tokens };
  }

  // Provider & Admin flow: always require MFA.
  if (!user.mfa_enabled) {
    logger.debug({ userId: user.id }, `login: rejected — ${input.role} has no MFA`);
    throw new AppError(403, 'MFA_NOT_SETUP', 'MFA is not set up. Please complete your account setup first.');
  }
  logger.debug({ userId: user.id }, `login: ${input.role} mfa_token issued`);
  return { type: 'mfa_required', mfa_token: signMfaToken(user.id) };
}
