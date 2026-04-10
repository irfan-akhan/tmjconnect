import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForMfaSetup, storeMfaSecret } from '../../db/queries/auth.queries';
import { verifyPurposeToken } from '../../utils/jwt';
import { encryptMfaSecret } from '../../utils/hash';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db'>;

export type SetupMfaInput = { setupToken: string };
export type SetupMfaOutput = { secret: string; qr_uri: string };

export async function execute(deps: Deps, input: SetupMfaInput): Promise<SetupMfaOutput> {
  const { db } = deps;

  const userId = verifyPurposeToken(input.setupToken, 'mfa_setup');
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired setup token.');

  const user = await findUserForMfaSetup(db, userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (user.mfa_enabled) throw new AppError(409, 'CONFLICT', 'MFA is already set up.');

  const totp = new OTPAuth.TOTP({
    issuer: 'TMJConnect',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const secret = totp.secret.base32;
  await storeMfaSecret(db, userId, encryptMfaSecret(secret));

  return { secret, qr_uri: totp.toString() };
}
