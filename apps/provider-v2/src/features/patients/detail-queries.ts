import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type PatientDetail = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  linked_at: string | null;
  consent_scope: string | null;
  diagnosis: string | null;
  adherence_pct: number | null;
  avg_pain_7d: number | null;
  last_activity_at: string | null;
  urgency: 'routine' | 'concerning' | 'urgent' | null;
};

export function useUpdatePatientLink(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { diagnosis?: string | null }) =>
      apiFetch<{ data: PatientDetail }>(`/providers/patients/${patientId}/link`, {
        method: 'PATCH',
        body,
      }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['patient', patientId], data);
    },
  });
}

export type SymptomLog = {
  id: string;
  patient_id: string;
  pain_level: number;
  pain_types: string[];
  body_areas: Array<{ area: string; side?: string }>;
  duration_minutes: number | null;
  triggers: string[];
  notes: string | null;
  logged_at: string;
  created_at: string;
};

export type Assignment = {
  id: string;
  exercise_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  frequency: string;
  sets: number;
  status: 'active' | 'paused' | 'completed';
  assigned_at: string;
};

export type ReportRow = {
  id: string;
  patient_id: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  status: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  pain_level: number | null;
  description_preview: string | null;
  flagged: boolean;
  submitted_at: string;
  patient_first_name: string;
  patient_last_name: string;
};

export function usePatientDetail(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: () =>
      apiFetch<{ data: PatientDetail }>(`/providers/patients/${patientId}`).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

type SymptomPage = {
  data: SymptomLog[];
  meta: { nextCursor: string | null; hasMore: boolean };
};

export function usePatientSymptoms(patientId: string) {
  return useInfiniteQuery({
    queryKey: ['patient', patientId, 'symptoms'],
    queryFn: ({ pageParam }) =>
      apiFetch<SymptomPage>(`/providers/patients/${patientId}/symptoms`, {
        query: { limit: 20, cursor: pageParam || undefined },
      }),
    initialPageParam: '' as string,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor ?? undefined : undefined),
    enabled: Boolean(patientId),
  });
}

export function usePatientAssignments(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId, 'assignments'],
    queryFn: () =>
      apiFetch<{ data: Assignment[] }>(
        `/providers/patients/${patientId}/assignments`,
      ).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

export function usePatientReports(patientId: string, page = 1) {
  return useQuery({
    queryKey: ['patient', patientId, 'reports', page],
    queryFn: () =>
      apiFetch<{ data: ReportRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        `/providers/patients/${patientId}/reports`,
        { query: { page, limit: 20 } },
      ),
    enabled: Boolean(patientId),
  });
}

// ─── Analytics (pain trend + exercise compliance + …) ─────────────────────────
// Shape mirrors the API's PatientAnalytics from
// apps/api/src/db/queries/patient-analytics.queries.ts.
export type PatientAnalytics = {
  pain_trend: Array<{ date: string; pain_level: number }>;
  pain_summary: { avg_pain: number; min_pain: number; max_pain: number; total_logs: number };
  trigger_frequency: Array<{ trigger: string; count: number }>;
  exercise_compliance: { completed: number; assigned: number; rate: number };
  body_area_frequency: Array<{ area: string; count: number }>;
  day_of_week: Array<{ day: string; avg_pain: number }>;
};

export function usePatientAnalytics(patientId: string, days: number) {
  return useQuery({
    queryKey: ['patient', patientId, 'analytics', days],
    queryFn: () =>
      apiFetch<{ data: PatientAnalytics }>(
        `/providers/patients/${patientId}/analytics`,
        { query: { days } },
      ).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

// ─── Clinic visits ────────────────────────────────────────────────────────────
export type ClinicVisit = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  visited_at: string;
  notes: string | null;
  created_at: string;
};

export function useLastClinicVisit(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId, 'clinic-visits', 'last'],
    queryFn: () =>
      apiFetch<{ data: ClinicVisit | null }>(
        `/providers/patients/${patientId}/clinic-visits/last`,
      ).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

export function useRecordClinicVisit(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { visited_at: string; notes?: string | null }) =>
      apiFetch<{ data: ClinicVisit }>(
        `/providers/patients/${patientId}/clinic-visits`,
        { method: 'POST', body },
      ).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'clinic-visits'] });
    },
  });
}
