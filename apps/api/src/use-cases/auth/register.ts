import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserByEmail, createUserTransaction } from '../../db/queries/auth.queries';
import { hashPassword, generateVerifyCode, encryptVerifyCode } from '../../utils/hash';
import { EMAIL_VERIFY_TTL_HOURS } from '../../config/constants';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type RegisterInput = {
  role: 'patient' | 'provider';
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  // Provider-only fields:
  license_number?: string;
  license_type?: string;
  specialty?: string;
  clinic_name?: string;
  credentials?: string[] | null;
};

export async function execute(deps: Deps, input: RegisterInput): Promise<void> {
  const { db, email, logger } = deps;

  const existing = await findUserByEmail(db, input.email);
  if (existing) throw new AppError(409, 'CONFLICT', 'An account with this email already exists.');

  const password_hash = await hashPassword(input.password);
  const email_verify_code = generateVerifyCode();
  const email_verify_expires = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);

  await createUserTransaction(db, {
    email: input.email.toLowerCase(),
    password_hash,
    role: input.role,
    email_verify_code: encryptVerifyCode(email_verify_code),
    email_verify_expires,
    first_name: input.first_name,
    last_name: input.last_name,
    timezone: input.timezone ?? 'America/Chicago',
    license_number: input.license_number,
    license_type: input.license_type,
    specialty: input.specialty,
    clinic_name: input.clinic_name,
    credentials: input.credentials,
  });

  email.sendVerifyEmail(input.email, email_verify_code)
    .catch((err) => logger.error({ err }, 'Failed to send verify email'));
}
