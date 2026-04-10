import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { insertLinkingCode } from '../../db/queries/linking.queries';
import {
  LINKING_CODE_LENGTH,
  LINKING_CODE_CHARS,
  LINKING_CODE_TTL_DAYS,
  LINKING_CODE_MAX_RETRIES,
} from '../../config/constants';
import { randomInt } from 'crypto';

type Deps = Pick<Container, 'db'>;

export type GenerateCodeInput = { providerId: string };

function generateRandomCode(): string {
  let code = '';
  for (let i = 0; i < LINKING_CODE_LENGTH; i++) {
    code += LINKING_CODE_CHARS[randomInt(LINKING_CODE_CHARS.length)];
  }
  return code;
}

export async function execute(deps: Deps, input: GenerateCodeInput) {
  const expiresAt = new Date(Date.now() + LINKING_CODE_TTL_DAYS * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < LINKING_CODE_MAX_RETRIES; attempt++) {
    try {
      const code = generateRandomCode();
      return await insertLinkingCode(deps.db, input.providerId, code, expiresAt);
    } catch (err: unknown) {
      // 23505 = unique_violation — code collision, retry.
      const isUniqueViolation = err instanceof Error && 'code' in err && (err as { code: string }).code === '23505';
      if (isUniqueViolation && attempt < LINKING_CODE_MAX_RETRIES - 1) continue;
      throw err;
    }
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to generate unique linking code.');
}
