/**
 * patient-init-mfa — Generates an MFA setup token for an authenticated patient.
 * The patient then uses the existing /auth/mfa/setup and /auth/mfa/verify-setup
 * endpoints with this token to complete setup.
 */
import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserForMfaSetup } from '../../db/queries/auth.queries';
import { signMfaSetupToken } from '../../utils/jwt';

type Deps = Pick<Container, 'db'>;

export type PatientInitMfaInput = { userId: string };

export async function execute(deps: Deps, input: PatientInitMfaInput) {
  const user = await findUserForMfaSetup(deps.db, input.userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (user.mfa_enabled) throw new AppError(409, 'CONFLICT', 'MFA is already enabled.');

  return { setup_token: signMfaSetupToken(input.userId) };
}
