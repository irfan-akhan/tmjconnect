import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForMfaSetup, enableMfaTransaction, findUserCoreById, replaceMfaTransaction } from '../../db/queries/auth.queries';
import { getProfileFirstName } from '../../db/queries/auth.queries';
import { verifyMfaSetupToken } from '../../utils/jwt';
import { decryptMfaSecret, encryptMfaSecret, generateBackupCodes, hashBackupCode } from '../../utils/hash';
import { BACKUP_CODE_COUNT } from '../../config/constants';
import { issueTokens } from './helpers';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type VerifyMfaSetupInput = { setupToken: string; code: string };

export type VerifyMfaSetupOutput = {
  backup_codes: string[];
  access_token: string;
  refresh_token: string;
};

export async function execute(deps: Deps, input: VerifyMfaSetupInput): Promise<VerifyMfaSetupOutput> {
  const { db } = deps;

  const setup = verifyMfaSetupToken(input.setupToken);
  if (!setup) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired setup token.');

  const user = await findUserForMfaSetup(db, setup.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (setup.mode === 'enroll' && !user.mfa_secret) {
    throw new AppError(400, 'BAD_REQUEST', 'MFA setup not initiated. Call /auth/mfa/setup first.');
  }
  if (setup.mode === 'reconfigure' && !setup.pendingSecret) {
    throw new AppError(400, 'BAD_REQUEST', 'MFA reconfiguration setup not initiated. Call /auth/mfa/setup first.');
  }

  const secret = setup.mode === 'reconfigure' ? setup.pendingSecret! : decryptMfaSecret(user.mfa_secret!);
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });
  if (totp.validate({ token: input.code, window: 1 }) === null) {
    throw new AppError(400, 'INVALID_CODE', 'Invalid verification code.');
  }

  const plainCodes = generateBackupCodes(BACKUP_CODE_COUNT);
  const hashedCodes = await Promise.all(plainCodes.map(hashBackupCode));
  if (setup.mode === 'reconfigure') {
    await replaceMfaTransaction(db, setup.userId, encryptMfaSecret(secret), hashedCodes);
  } else {
    await enableMfaTransaction(db, setup.userId, hashedCodes);
  }

  // Issue tokens so the provider is logged in immediately after MFA setup.
  const fullUser = await findUserCoreById(db, setup.userId);
  if (!fullUser) throw new AppError(500, 'INTERNAL', 'User not found after MFA setup.');

  const tokens = await issueTokens(db, fullUser, 'mfa-setup', null);
  const firstName = await getProfileFirstName(db, setup.userId).catch(() => null);
  deps.email.sendMfaEnabled(fullUser.email, firstName ?? '')
    .catch((err) => deps.logger.warn({ err, userId: setup.userId }, 'MFA enabled email failed'));

  return {
    backup_codes: plainCodes,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshTokenValue,
  };
}
