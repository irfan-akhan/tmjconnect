import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findUserForMfaVerify,
  findUnusedBackupCodes,
  markBackupCodeUsed,
  clearSmsMfaCode,
  insertLoginEvent,
} from '../../db/queries/auth.queries';
import { verifyPurposeToken } from '../../utils/jwt';
import { decryptMfaSecret, compareBackupCode, hashToken } from '../../utils/hash';
import { issueTokens, checkNewDevice } from './helpers';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type VerifyMfaInput = {
  mfa_token: string;
  code: string;
  type: 'totp' | 'sms' | 'backup';
  ip: string | null;
  deviceInfo: string;
};

export type VerifyMfaOutput = { accessToken: string; refreshTokenValue: string };

export async function execute(deps: Deps, input: VerifyMfaInput): Promise<VerifyMfaOutput> {
  const { db, email, logger } = deps;

  const userId = verifyPurposeToken(input.mfa_token, 'mfa');
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired MFA token.');

  const user = await findUserForMfaVerify(db, userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  let verified = false;

  if (input.type === 'totp') {
    if (!user.mfa_secret) throw new AppError(400, 'MFA_NOT_SETUP', 'MFA not configured.');
    const secret = decryptMfaSecret(user.mfa_secret);
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
    verified = totp.validate({ token: input.code, window: 1 }) !== null;
  } else if (input.type === 'sms') {
    if (!user.sms_mfa_code_hash || !user.sms_mfa_expires_at || new Date() > user.sms_mfa_expires_at) {
      await clearSmsMfaCode(db, userId).catch(() => {});
      throw new AppError(401, 'INVALID_CODE', 'Invalid or expired MFA code.');
    }
    verified = hashToken(input.code) === user.sms_mfa_code_hash;
  } else if (input.type === 'backup') {
    const codes = await findUnusedBackupCodes(db, userId);
    for (const c of codes) {
      if (await compareBackupCode(input.code, c.code_hash)) {
        await markBackupCodeUsed(db, c.id);
        verified = true;
        break;
      }
    }
  }

  if (!verified) throw new AppError(401, 'INVALID_CODE', 'Invalid MFA code.');

  if (input.type === 'sms') {
    await clearSmsMfaCode(db, userId);
  }

  const tokens = await issueTokens(db, user, input.deviceInfo, input.ip);
  await insertLoginEvent(db, {
    user_id: user.id,
    email: user.email,
    success: true,
    ip_address: input.ip,
    device_info: input.deviceInfo,
  });
  checkNewDevice(db, email, logger, user.id, user.email, input.ip ?? '', input.deviceInfo);

  return tokens;
}
