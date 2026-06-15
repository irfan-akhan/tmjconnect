import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  findUnusedBackupCodes,
  findUserForMfaVerify,
  findUserPasswordHash,
  markBackupCodeUsed,
} from '../../db/queries/auth.queries';
import { compareBackupCode, comparePassword, decryptMfaSecret } from '../../utils/hash';
import { signMfaSetupToken } from '../../utils/jwt';
import * as OTPAuth from 'otpauth';

type Deps = Pick<Container, 'db'>;

export type InitMfaReconfigureInput = {
  userId: string;
  password: string;
  code: string;
  type: 'totp' | 'backup';
};

export async function execute(deps: Deps, input: InitMfaReconfigureInput): Promise<{ setup_token: string }> {
  const passwordUser = await findUserPasswordHash(deps.db, input.userId);
  if (!passwordUser) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const validPassword = await comparePassword(input.password, passwordUser.password_hash);
  if (!validPassword) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');

  const user = await findUserForMfaVerify(deps.db, input.userId);
  if (!user?.mfa_secret) throw new AppError(409, 'MFA_NOT_SETUP', 'MFA is not configured.');

  let verified = false;
  if (input.type === 'totp') {
    const secret = decryptMfaSecret(user.mfa_secret);
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
    verified = totp.validate({ token: input.code, window: 1 }) !== null;
  } else {
    const codes = await findUnusedBackupCodes(deps.db, input.userId);
    for (const code of codes) {
      if (await compareBackupCode(input.code, code.code_hash)) {
        await markBackupCodeUsed(deps.db, code.id);
        verified = true;
        break;
      }
    }
  }

  if (!verified) throw new AppError(401, 'INVALID_CODE', 'Invalid MFA code.');

  return { setup_token: signMfaSetupToken(input.userId, 'reconfigure') };
}