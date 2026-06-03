import type { Container } from '../../config/container';
import { findUserByEmailActive, upsertPasswordResetTransaction } from '../../db/queries/auth.queries';
import { generateVerifyCode, hashToken } from '../../utils/hash';
import { PASSWORD_RESET_OTP_TTL_SECONDS } from '../../config/constants';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type ForgotPasswordInput = { email: string };

// Always returns void — never reveals whether the email exists.
export async function execute(deps: Deps, input: ForgotPasswordInput): Promise<void> {
  const { db, email, logger } = deps;

  const user = await findUserByEmailActive(db, input.email);
  if (!user) return;

  const code = generateVerifyCode();
  const tokenHash = hashToken(code);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_SECONDS * 1000);

  await upsertPasswordResetTransaction(db, user.id, tokenHash, expiresAt);

  email.sendPasswordResetCode(user.email, code)
    .catch((err) => logger.error({ err }, 'Failed to send password reset email'));
}
