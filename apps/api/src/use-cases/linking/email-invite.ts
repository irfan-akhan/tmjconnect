import type { Container } from '../../config/container';
import { getProviderName } from '../../db/queries/linking.queries';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type EmailInviteInput = {
  providerId: string;
  patientEmail: string;
  code: string;
};

export async function execute(deps: Deps, input: EmailInviteInput) {
  const { db, email, logger } = deps;

  const providerName = await getProviderName(db, input.providerId) ?? 'Your provider';

  email.sendEmailInvite(input.patientEmail, providerName, input.code)
    .catch((err) => logger.error({ err }, 'Failed to send linking email invite'));
}
