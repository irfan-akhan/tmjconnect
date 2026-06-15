import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForMfaSetup, storeMfaSecret } from '../../db/queries/auth.queries';
import { signMfaSetupToken, verifyMfaSetupToken } from '../../utils/jwt';
import { encryptMfaSecret } from '../../utils/hash';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db'>;

export type SetupMfaInput = { setupToken: string };
export type SetupMfaOutput = { secret: string; qr_uri: string; otpauth_url: string; setup_token?: string };

export async function execute(deps: Deps, input: SetupMfaInput): Promise<SetupMfaOutput> {
  const { db } = deps;

  const setup = verifyMfaSetupToken(input.setupToken);
  if (!setup) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired setup token.');

  const user = await findUserForMfaSetup(db, setup.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (user.mfa_enabled && setup.mode !== 'reconfigure') throw new AppError(409, 'CONFLICT', 'MFA is already set up.');
  if (!user.mfa_enabled && setup.mode === 'reconfigure') throw new AppError(409, 'CONFLICT', 'MFA is not enabled.');

  const totp = new OTPAuth.TOTP({
    issuer: 'TMJConnect',
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  const secret = totp.secret.base32;
  const setupToken = setup.mode === 'reconfigure'
    ? signMfaSetupToken(setup.userId, 'reconfigure', secret)
    : undefined;
  if (setup.mode === 'enroll') {
    await storeMfaSecret(db, setup.userId, encryptMfaSecret(secret));
  }

  return { secret, qr_uri: totp.toString(), otpauth_url: totp.toString(), setup_token: setupToken };
}
