/**
 * Kick off an email change: validate the password, stash the new address +
 * a 6-digit code on the user row, and dispatch the code to the new address.
 *
 * Contract: the code is sent to the NEW email (the one the user is trying
 * to adopt), not the current one. This proves the user controls the target
 * address; ownership of the old address is proven at verify time by their
 * logged-in session.
 *
 * We always reply 200 from the route — a lookup collision (someone else
 * already owns the new email) is surfaced here as an inline error on the
 * UI, not a success-then-fail, to avoid leaking signup state.
 */

import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { users } from '../../db/schema';
import {
  findUserByEmail,
  findUserPasswordHash,
} from '../../db/queries/auth.queries';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword, encryptVerifyCode } from '../../utils/hash';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type RequestEmailChangeInput = {
  userId: string;
  currentPassword: string;
  newEmail: string;
};

const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function sixDigitCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

export async function execute(deps: Deps, input: RequestEmailChangeInput) {
  const { db, email, logger } = deps;

  const me = await findUserPasswordHash(db, input.userId);
  if (!me) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const passwordOk = await comparePassword(input.currentPassword, me.password_hash);
  if (!passwordOk) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Current password is incorrect.');
  }

  const normalised = input.newEmail.trim().toLowerCase();

  const [current] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (current?.email === normalised) {
    throw new AppError(
      400,
      'SAME_EMAIL',
      'The new email matches your current one.',
    );
  }

  const clash = await findUserByEmail(db, normalised);
  if (clash) {
    // Generic error — we're authenticated so enumeration isn't a concern,
    // but we still phrase it as "couldn't send" to be consistent with the
    // forgot-password endpoint's posture.
    throw new AppError(
      409,
      'EMAIL_IN_USE',
      'That email is already associated with another account.',
    );
  }

  const code = sixDigitCode();
  const encryptedCode = encryptVerifyCode(code);
  const expiresAt = new Date(Date.now() + EXPIRY_MS);

  await db
    .update(users)
    .set({
      pending_email: normalised,
      pending_email_code: encryptedCode,
      pending_email_expires: expiresAt,
      updated_at: sql`NOW()`,
    })
    .where(eq(users.id, input.userId));

  email
    .sendEmailChangeCode(normalised, code)
    .catch((err: Error) =>
      logger.error({ err }, 'Failed to send email-change code'),
    );

  return { ok: true as const, expires_at: expiresAt.toISOString() };
}
