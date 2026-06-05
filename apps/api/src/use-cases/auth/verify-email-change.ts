/**
 * Finalise an email change: check the 6-digit code against the encrypted
 * pending_email_code, then swap users.email → pending_email and clear the
 * three pending_* columns.
 *
 * A concurrent race where two different codes both "win" is impossible —
 * we use the user's row as the single source of truth, and only one
 * pending_email_code exists at a time (re-requests overwrite it).
 *
 * The unique index on users.email would surface a collision as a 500, but
 * we also check it up front at request time — by the time we reach verify
 * the new email is still ours to take.
 */

import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { users } from '../../db/schema';
import { AppError } from '../../middleware/errorHandler';
import { decryptVerifyCode } from '../../utils/hash';
import { findUserByEmail, getProfileFirstName } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type VerifyEmailChangeInput = {
  userId: string;
  code: string;
};

export async function execute(deps: Deps, input: VerifyEmailChangeInput) {
  const { db } = deps;

  const [row] = await db
    .select({
      email: users.email,
      pending_email: users.pending_email,
      pending_email_code: users.pending_email_code,
      pending_email_expires: users.pending_email_expires,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!row?.pending_email || !row.pending_email_code || !row.pending_email_expires) {
    throw new AppError(400, 'NO_PENDING_CHANGE', 'No email change is pending.');
  }

  if (new Date(row.pending_email_expires).getTime() < Date.now()) {
    // Wipe the stale attempt so the user restarts the request flow cleanly.
    await clearPending(db, input.userId);
    throw new AppError(400, 'CODE_EXPIRED', 'That code has expired. Please request a new one.');
  }

  let stored: string;
  try {
    stored = decryptVerifyCode(row.pending_email_code);
  } catch {
    throw new AppError(500, 'INTERNAL', 'Could not verify code.');
  }

  if (stored !== input.code) {
    throw new AppError(400, 'INVALID_CODE', 'The code you entered is incorrect.');
  }

  // Race guard: the email might have been claimed between request and
  // verify. If so, surface a clean error rather than a UNIQUE constraint
  // violation.
  const clash = await findUserByEmail(db, row.pending_email);
  if (clash && clash.id !== input.userId) {
    await clearPending(db, input.userId);
    throw new AppError(
      409,
      'EMAIL_IN_USE',
      'That email was taken while you waited. Try a different address.',
    );
  }

  await db
    .update(users)
    .set({
      email: row.pending_email,
      pending_email: null,
      pending_email_code: null,
      pending_email_expires: null,
      updated_at: sql`NOW()`,
    })
    .where(eq(users.id, input.userId));

  const firstName = await getProfileFirstName(db, input.userId).catch(() => null);

  deps.email.sendEmailChanged(row.email, firstName ?? '', row.pending_email)
    .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Email change notice to previous email failed'));
  deps.email.sendEmailChanged(row.pending_email, firstName ?? '', row.pending_email)
    .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'Email change notice to new email failed'));

  return { ok: true as const, new_email: row.pending_email };
}

async function clearPending(db: Deps['db'], userId: string) {
  await db
    .update(users)
    .set({
      pending_email: null,
      pending_email_code: null,
      pending_email_expires: null,
    })
    .where(eq(users.id, userId));
}
