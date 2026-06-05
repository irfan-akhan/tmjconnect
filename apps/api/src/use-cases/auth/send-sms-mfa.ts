import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForSms, setSmsMfaCode } from '../../db/queries/auth.queries';
import { verifyPurposeToken } from '../../utils/jwt';
import { generateVerifyCode, hashToken } from '../../utils/hash';
import { SMS_MFA_OTP_TTL_SECONDS } from '../../config/constants';

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

  const code = generateVerifyCode();
  const expiresAt = new Date(Date.now() + SMS_MFA_OTP_TTL_SECONDS * 1000);
  await setSmsMfaCode(db, user.id, hashToken(code), expiresAt);

  sms.sendMfaCode(user.phone, code)
    .catch((err) => logger.error({ err }, 'Failed to send SMS MFA code'));
}
