import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import {
  getPatientDetail,
  listPatientAssignments,
  verifyProviderLink,
} from '../../db/queries/providers.queries';
import { getPatientAnalytics } from '../../db/queries/patient-analytics.queries';
import { listProviderReports } from '../../db/queries/reports.queries';
import { listSymptomLogsForPatient } from '../../db/queries/symptoms.queries';
import { getLastClinicVisitForPatient } from '../../db/queries/clinic-visits.queries';

type Deps = Pick<Container, 'db'>;

type Input = {
  providerId: string;
  patientId: string;
  days: number;
  activityLimit: number;
};

type OverviewActivity = {
  id: string;
  type: 'report' | 'symptom' | 'assignment';
  tone: 'urgent' | 'info' | 'exercise' | 'calm';
  at: string;
  title: string;
  subtitle: string;
};

export type PatientOverviewOutput = {
  kpis: {
    exercise_adherence_pct: number | null;
    avg_pain_7d: number | null;
    linked_since: string | null;
    last_clinic_visit_at: string | null;
  };
  pain_trend: Array<{ date: string; pain_level: number }>;
  treatment_plan: {
    diagnosis: string | null;
    current_protocol: Array<{ assignment_id: string; title: string; frequency: string; sets: number }>;
  };
  recent_activity: OverviewActivity[];
};

export async function execute(deps: Deps, input: Input): Promise<PatientOverviewOutput> {
  const linked = await verifyProviderLink(deps.db, input.providerId, input.patientId);
  if (!linked) throw new AppError(403, 'FORBIDDEN', 'Patient is not linked to your account.');

  const [
    detail,
    analytics,
    assignments,
    reports,
    symptoms,
    lastClinicVisit,
  ] = await Promise.all([
    getPatientDetail(deps.db, input.providerId, input.patientId),
    getPatientAnalytics(deps.db, input.providerId, input.patientId, input.days),
    listPatientAssignments(deps.db, input.providerId, input.patientId, 50, 0),
    listProviderReports(
      deps.db,
      input.providerId,
      Math.max(input.activityLimit, 20),
      0,
      { patient_id: input.patientId },
      'created_at',
      'desc',
    ),
    listSymptomLogsForPatient(deps.db, input.patientId, null, Math.max(input.activityLimit, 20)),
    getLastClinicVisitForPatient(deps.db, input.patientId),
  ]);

  if (!detail) throw new AppError(404, 'NOT_FOUND', 'Patient not found.');

  const currentProtocol = assignments
    .filter((a) => a.status === 'active')
    .slice(0, 4)
    .map((a) => ({
      assignment_id: a.id,
      title: a.title,
      frequency: a.frequency,
      sets: a.sets,
    }));

  const reportActivity: OverviewActivity[] = reports.map((r) => ({
    id: `report-${r.id}`,
    type: 'report',
    tone: r.urgency === 'urgent' ? 'urgent' : 'info',
    at: r.submitted_at,
    title: `Submitted ${r.urgency} report${r.pain_level != null ? ` — pain ${r.pain_level}/10` : ''}`,
    subtitle: r.description_preview ?? 'Patient submitted a report update.',
  }));

  const symptomActivity: OverviewActivity[] = symptoms
    .slice(0, input.activityLimit)
    .map((s) => ({
      id: `symptom-${s.id}`,
      type: 'symptom',
      tone: 'calm',
      at: s.logged_at.toISOString(),
      title: 'Logged symptom entry',
      subtitle: `Pain ${s.pain_level}/10${s.notes ? ` · ${s.notes}` : ''}`,
    }));

  const assignmentActivity: OverviewActivity[] = assignments.map((a) => ({
    id: `assignment-${a.id}`,
    type: 'assignment',
    tone: 'exercise',
    at: a.assigned_at instanceof Date ? a.assigned_at.toISOString() : String(a.assigned_at),
    title: `Exercise assigned: ${a.title}`,
    subtitle: `${a.sets} sets · ${a.frequency}`,
  }));

  const recentActivity = [...reportActivity, ...symptomActivity, ...assignmentActivity]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, input.activityLimit);

  return {
    kpis: {
      exercise_adherence_pct: detail.adherence_pct,
      avg_pain_7d: detail.avg_pain_7d,
      linked_since: detail.linked_at,
      last_clinic_visit_at: lastClinicVisit?.visited_at ?? null,
    },
    pain_trend: analytics.pain_trend,
    treatment_plan: {
      diagnosis: detail.diagnosis,
      current_protocol: currentProtocol,
    },
    recent_activity: recentActivity,
  };
}