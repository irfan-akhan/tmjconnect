import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForSms } from '../../db/queries/auth.queries';
import { verifyPurposeToken } from '../../utils/jwt';
import { decryptMfaSecret } from '../../utils/hash';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db' | 'sms' | 'logger'>;

export type SendSmsMfaInput = { mfa_token: string };

export async function execute(deps: Deps, input: SendSmsMfaInput): Promise<void> {
  const { db, sms, logger } = deps;

  const userId = verifyPurposeToken(input.mfa_token, 'mfa');
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired MFA token.');

  const user = await findUserForSms(db, userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (!user.phone) throw new AppError(400, 'NO_PHONE', 'No phone number on file for SMS MFA.');
  if (!user.mfa_secret) throw new AppError(400, 'MFA_NOT_SETUP', 'MFA not configured.');

  const secret = decryptMfaSecret(user.mfa_secret);
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
    algorithm: 'SHA1',
  });

  sms.sendMfaCode(user.phone, totp.generate())
    .catch((err) => logger.error({ err }, 'Failed to send SMS MFA code'));
}
