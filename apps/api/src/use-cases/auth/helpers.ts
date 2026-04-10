/**
 * Shared helpers used across multiple auth use cases.
 * Not exported from the module boundary — internal to use-cases/auth/.
 */
import type { Container } from '../../config/container';
import {
  insertTokenPair,
  findSessionsByDeviceInfo,
  getProfileFirstName,
} from '../../db/queries/auth.queries';
import { signAccessToken, refreshTokenExpiresAt } from '../../utils/jwt';
import { generateToken, hashToken } from '../../utils/hash';
import { randomUUID } from 'crypto';

type Db = Container['db'];

export async function issueTokens(
  db: Db,
  user: { id: string; email: string; role: string },
  deviceInfo: string,
  ip: string | null,
  existingFamily?: string,
) {
  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role as 'patient' | 'provider' | 'admin',
  });
  const tokenValue = generateToken(64);
  const tokenHash = hashToken(tokenValue);
  const tokenFamily = existingFamily ?? randomUUID();
  await insertTokenPair(db, user.id, tokenHash, tokenFamily, deviceInfo, ip, refreshTokenExpiresAt());
  return { accessToken, refreshTokenValue: tokenValue };
}

export function checkNewDevice(
  db: Db,
  emailService: Container['email'],
  logger: Container['logger'],
  userId: string,
  userEmail: string,
  ip: string,
  deviceInfo: string,
) {
  void (async () => {
    try {
      const existing = await findSessionsByDeviceInfo(db, userId, deviceInfo);
      if (existing.length <= 1) {
        const firstName = await getProfileFirstName(db, userId);
        await emailService.sendNewDeviceLogin(userEmail, firstName ?? 'there', ip, deviceInfo);
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to send new device email');
    }
  })();
}
