/**
 * patient-disable-mfa — Disables MFA for an authenticated patient.
 * Requires current password for verification before disabling.
 * Clears mfa_secret, mfa_enabled, and all backup codes.
 */
import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserPasswordHash } from '../../db/queries/auth.queries';
import { comparePassword } from '../../utils/hash';
import { eq } from 'drizzle-orm';
import { users, mfaBackupCodes } from '../../db/schema';
import { getUserEmailProfile } from '../../db/queries/auth.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type PatientDisableMfaInput = { userId: string; password: string };

export async function execute(deps: Deps, input: PatientDisableMfaInput) {
  const { db } = deps;

  const user = await findUserPasswordHash(db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password.');

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ mfa_enabled: false, mfa_secret: null })
      .where(eq(users.id, input.userId));
    await tx
      .delete(mfaBackupCodes)
      .where(eq(mfaBackupCodes.user_id, input.userId));
  });
  const contact = await getUserEmailProfile(db, input.userId).catch(() => null);
  if (contact?.email) {
    deps.email.sendMfaDisabled(contact.email, contact.first_name ?? '')
      .catch((err) => deps.logger.warn({ err, userId: input.userId }, 'MFA disabled email failed'));
  }
}
