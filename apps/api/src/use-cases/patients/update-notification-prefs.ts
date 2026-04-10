import type { Container } from '../../config/container';
import { updateNotificationPrefs, getNotificationPrefs } from '../../db/queries/patients.queries';

type Deps = Pick<Container, 'db'>;

export type UpdateNotificationPrefsInput = {
  userId: string;
  fields: {
    exercise_reminders?: boolean;
    symptom_checkin?: boolean;
    provider_messages?: boolean;
    report_updates?: boolean;
    tips_updates?: boolean;
    email_digest?: 'instant' | 'daily' | 'weekly' | 'off';
  };
};

export async function execute(deps: Deps, input: UpdateNotificationPrefsInput) {
  const { db } = deps;
  await updateNotificationPrefs(db, input.userId, input.fields);
  return (await getNotificationPrefs(db, input.userId))!;
}
