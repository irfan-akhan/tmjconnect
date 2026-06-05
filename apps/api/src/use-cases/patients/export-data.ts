import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  users,
  profiles,
  symptomLogs,
  reports,
  reportResponses,
  exerciseAssignments,
  exerciseCompletions,
  exercises,
  patientProviderLinks,
  reminders,
  notificationPreferences,
  reportRequests,
} from '../../db/schema';

type Deps = Pick<Container, 'db' | 'email' | 'logger'>;

export type ExportDataInput = { patientId: string };

/**
 * HIPAA right-of-access bundle. Returns every PHI record the user owns or
 * that references them. Synchronous — fine at pilot scale (25–50 users).
 * For production scale this should be backgrounded and emit a signed download
 * URL when complete.
 *
 * Excludes data that belongs to the provider:
 *   - clinical_notes (provider-private)
 *   - report_responses.internal_notes
 */
export async function execute(deps: Deps, input: ExportDataInput) {
  const { db } = deps;

  const [account] = await db
    .select({
      id: users.id,
      email: users.email,
      phone: users.phone,
      role: users.role,
      created_at: users.created_at,
    })
    .from(users)
    .where(and(eq(users.id, input.patientId), isNull(users.deleted_at)));

  if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found.');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.user_id, input.patientId));

  const symptoms = await db
    .select()
    .from(symptomLogs)
    .where(eq(symptomLogs.patient_id, input.patientId))
    .orderBy(desc(symptomLogs.logged_at));

  // Reports — strip internal_notes from responses before returning.
  const patientReports = await db
    .select()
    .from(reports)
    .where(eq(reports.patient_id, input.patientId))
    .orderBy(desc(reports.submitted_at));

  const reportIds = patientReports.map((r) => r.id);
  const responses = reportIds.length
    ? await db
        .select({
          id: reportResponses.id,
          report_id: reportResponses.report_id,
          provider_id: reportResponses.provider_id,
          message: reportResponses.message,
          responded_at: reportResponses.responded_at,
        })
        .from(reportResponses)
    : [];

  const assignments = await db
    .select({
      id: exerciseAssignments.id,
      exercise_id: exerciseAssignments.exercise_id,
      provider_id: exerciseAssignments.provider_id,
      frequency: exerciseAssignments.frequency,
      sets: exerciseAssignments.sets,
      status: exerciseAssignments.status,
      assigned_at: exerciseAssignments.assigned_at,
      exercise_title: exercises.title,
    })
    .from(exerciseAssignments)
    .innerJoin(exercises, eq(exercises.id, exerciseAssignments.exercise_id))
    .where(eq(exerciseAssignments.patient_id, input.patientId))
    .orderBy(desc(exerciseAssignments.assigned_at));

  const completions = await db
    .select()
    .from(exerciseCompletions)
    .where(eq(exerciseCompletions.patient_id, input.patientId))
    .orderBy(desc(exerciseCompletions.completed_at));

  const links = await db
    .select()
    .from(patientProviderLinks)
    .where(eq(patientProviderLinks.patient_id, input.patientId));

  const reminderRows = await db
    .select()
    .from(reminders)
    .where(eq(reminders.user_id, input.patientId));

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.user_id, input.patientId));

  const requests = await db
    .select()
    .from(reportRequests)
    .where(eq(reportRequests.patient_id, input.patientId))
    .orderBy(desc(reportRequests.created_at));

  deps.email.sendDataExported(account.email, profile?.first_name ?? '')
    .catch((err) => deps.logger.warn({ err, patientId: input.patientId }, 'Data export email failed'));

  return {
    meta: {
      exported_at: new Date().toISOString(),
      format: 'tmjconnect.v1.export',
      notice:
        'This archive contains all personal health information TMJConnect holds about you. Provider clinical notes (clinical_notes) and provider-private internal notes on report responses are excluded by design — they are the provider\'s working records, not yours.',
    },
    account,
    profile,
    symptom_logs: symptoms,
    reports: patientReports,
    report_responses: responses.filter((r) => reportIds.includes(r.report_id)),
    exercise_assignments: assignments,
    exercise_completions: completions,
    provider_links: links,
    reminders: reminderRows,
    notification_preferences: prefs ?? null,
    report_requests: requests,
  };
}
