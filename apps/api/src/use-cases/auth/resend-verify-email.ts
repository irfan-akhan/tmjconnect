import type { Container } from '../../config/container';
import { findUnverifiedUserForResend, updateVerifyCode } from '../../db/queries/auth.queries';
import { generateVerifyCode, encryptVerifyCode } from '../../utils/hash';
import { RESEND_VERIFY_COOLDOWN_SECONDS, VERIFICATION_CODE_TTL_SECONDS } from '../../config/constants';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type ResendVerifyEmailInput = { email: string };

// Always returns void — never reveals whether the email exists.
export async function execute(deps: Deps, input: ResendVerifyEmailInput): Promise<void> {
  const { db, email, logger } = deps;

  const user = await findUnverifiedUserForResend(db, input.email);
  if (!user) return;

  const cooldownAgo = new Date(Date.now() - RESEND_VERIFY_COOLDOWN_SECONDS * 1000);
  if (user.updated_at && user.updated_at > cooldownAgo) return; // still within cooldown

  const newCode = generateVerifyCode();
  const newExpires = new Date(Date.now() + VERIFICATION_CODE_TTL_SECONDS * 1000);
  await updateVerifyCode(db, user.id, encryptVerifyCode(newCode), newExpires);

  email.sendVerifyEmail(user.email, newCode)
    .catch((err) => logger.error({ err }, 'Failed to resend verification email'));
}
