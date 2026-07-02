import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { findUserByEmailForRegister, createUserTransaction } from '../../db/queries/auth.queries';
import { hashPassword, generateVerifyCode, encryptVerifyCode } from '../../utils/hash';
import { VERIFICATION_CODE_TTL_SECONDS, RESEND_VERIFY_COOLDOWN_SECONDS } from '../../config/constants';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type RegisterInput = {
  role: 'patient' | 'provider';
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: 'US' | 'CA' | 'IN';
  date_of_birth?: string;
  timezone?: string;
  license_number?: string;
  license_type?: string;
  specialty?: string;
  clinic_name?: string;
  credentials?: string[] | null;
};

export async function execute(deps: Deps, input: RegisterInput): Promise<void> {
  const { db, email, logger } = deps;
  logger.debug({ role: input.role }, 'register: start');

  const existing = await findUserByEmailForRegister(db, input.email);

  // A verified account is a real conflict — reject it explicitly.
  if (existing?.email_verified) {
    logger.debug({ role: input.role }, 'register: rejected — verified email already exists');
    throw new AppError(409, 'CONFLICT', 'An account with this email already exists.');
  }

  // An UNVERIFIED account with this email is a stale/abandoned registration. Rather
  // than leak its existence with a 409 (which would defeat the anti-enumeration
  // stance of resend-verify-email / forgot-password), we overwrite it below — letting
  // a user who mistyped their password or details on the first attempt recover. To
  // avoid email bombing, if the record was just created/replaced we return the same
  // generic 201 without resending; the code from the first attempt is still valid.
  if (existing) {
    const cooldownAgo = new Date(Date.now() - RESEND_VERIFY_COOLDOWN_SECONDS * 1000);
    if (existing.updated_at && existing.updated_at > cooldownAgo) {
      logger.debug({ role: input.role }, 'register: unverified re-register within cooldown — skipping resend');
      return;
    }
  }

  const password_hash = await hashPassword(input.password);
  const email_verify_code = generateVerifyCode();
  const email_verify_expires = new Date(Date.now() + VERIFICATION_CODE_TTL_SECONDS * 1000);

  await createUserTransaction(db, {
    email: input.email.toLowerCase(),
    password_hash,
    role: input.role,
    email_verify_code: encryptVerifyCode(email_verify_code),
    email_verify_expires,
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone,
    country: input.country,
    date_of_birth: input.date_of_birth,
    timezone: input.timezone ?? 'America/Chicago',
    license_number: input.license_number,
    license_type: input.license_type,
    specialty: input.specialty,
    clinic_name: input.clinic_name,
    credentials: input.credentials,
  }, existing?.id);
  logger.debug(
    { role: input.role },
    existing ? 'register: unverified account replaced, sending verify email' : 'register: user created, sending verify email',
  );

  email.sendVerifyEmail(input.email, email_verify_code)
    .catch((err) => logger.error({ err }, 'Failed to send verify email'));
}
