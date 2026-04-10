import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForMfaSetup, enableMfaTransaction, findUserCoreById } from '../../db/queries/auth.queries';
import { verifyPurposeToken } from '../../utils/jwt';
import { decryptMfaSecret, generateBackupCodes, hashBackupCode } from '../../utils/hash';
import { BACKUP_CODE_COUNT } from '../../config/constants';
import { issueTokens } from './helpers';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db'>;

export type VerifyMfaSetupInput = { setupToken: string; code: string };

export type VerifyMfaSetupOutput = {
  backup_codes: string[];
  access_token: string;
  refresh_token: string;
};

export async function execute(deps: Deps, input: VerifyMfaSetupInput): Promise<VerifyMfaSetupOutput> {
  const { db } = deps;

  const userId = verifyPurposeToken(input.setupToken, 'mfa_setup');
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired setup token.');

  const user = await findUserForMfaSetup(db, userId);
  if (!user?.mfa_secret) {
    throw new AppError(400, 'BAD_REQUEST', 'MFA setup not initiated. Call /auth/mfa/setup first.');
  }

  const secret = decryptMfaSecret(user.mfa_secret);
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
  await enableMfaTransaction(db, userId, hashedCodes);

  // Issue tokens so the provider is logged in immediately after MFA setup.
  const fullUser = await findUserCoreById(db, userId);
  if (!fullUser) throw new AppError(500, 'INTERNAL', 'User not found after MFA setup.');

  const tokens = await issueTokens(db, fullUser, 'mfa-setup', null);

  return {
    backup_codes: plainCodes,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshTokenValue,
  };
}
