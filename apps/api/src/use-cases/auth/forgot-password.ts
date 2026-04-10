import type { Container } from '../../config/container';
import { findUserByEmailActive, upsertPasswordResetTransaction } from '../../db/queries/auth.queries';
import { generateToken, hashToken } from '../../utils/hash';
import { PASSWORD_RESET_TTL_SECONDS } from '../../config/constants';

type Deps = Pick<Container, 'db' | 'email' | 'logger' | 'env'>;

export type ForgotPasswordInput = { email: string };

// Always returns void — never reveals whether the email exists.
export async function execute(deps: Deps, input: ForgotPasswordInput): Promise<void> {
  const { db, email, logger, env } = deps;

  const user = await findUserByEmailActive(db, input.email);
  if (!user) return;

  const tokenValue = generateToken(64);
  const tokenHash = hashToken(tokenValue);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000);

  await upsertPasswordResetTransaction(db, user.id, tokenHash, expiresAt);

  const resetUrl = `${env.APP_URL}/reset-password?token=${tokenValue}`;
  email.sendPasswordReset(user.email, resetUrl)
    .catch((err) => logger.error({ err }, 'Failed to send password reset email'));
}
