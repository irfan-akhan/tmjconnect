import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
};

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
