import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { updateUser } from '../../db/queries/admin.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateUserInput = {
  userId: string;
  fields: {
    is_active?: boolean;
    role?: 'patient' | 'provider' | 'admin';
    force_password_reset?: boolean;
    force_mfa_reset?: boolean;
  };
};

export async function execute(deps: Deps, input: UpdateUserInput) {
  const result = await updateUser(deps.db, input.userId, input.fields);
  if (!result) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  return result;
}
