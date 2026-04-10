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

type Deps = Pick<Container, 'db'>;

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
}
