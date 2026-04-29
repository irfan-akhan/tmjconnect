import type { Container } from '../../config/container';
import {
  updatePreferences,
  type NotificationPreferences,
} from '../../db/queries/notification-preferences.queries';

type Deps = Pick<Container, 'db'>;

export type UpdatePreferencesInput = {
  userId: string;
  fields: Partial<NotificationPreferences>;
};

export async function execute(deps: Deps, input: UpdatePreferencesInput) {
  return updatePreferences(deps.db, input.userId, input.fields);
}
