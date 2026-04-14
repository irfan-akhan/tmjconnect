import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type ReportUrgency = 'routine' | 'concerning' | 'urgent';
export type ReportStatus = 'submitted' | 'viewed' | 'reviewed' | 'responded';

export type InboxRow = {
  id: string;
  patient_id: string;
  urgency: ReportUrgency;
  status: ReportStatus;
  pain_level: number | null;
  description_preview: string | null;
  flagged: boolean;
  submitted_at: string;
  patient_first_name: string;
  patient_last_name: string;
};

export type Report = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  urgency: ReportUrgency;
  pain_level: number | null;
  description: string;
  photo_url: string | null;
  period_start: string | null;
  period_end: string | null;
  summary_data: Record<string, unknown>;
  patient_notes: string | null;
  status: ReportStatus;
  flagged: boolean;
  submitted_at: string;
  viewed_at: string | null;
  reviewed_at: string | null;
};

export type ReportResponse = {
  id: string;
  report_id: string;
  provider_id: string | null;
  message: string;
  internal_notes: string | null;
  responded_at: string;
};

export type InboxFilters = {
  page: number;
  limit: number;
  status?: ReportStatus;
  urgency?: ReportUrgency;
};

export function useInbox(filters: InboxFilters) {
  return useQuery({
    queryKey: ['reports', 'inbox', filters],
    queryFn: () =>
      apiFetch<{ data: InboxRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        '/reports/inbox',
        {
          query: {
            page: filters.page,
            limit: filters.limit,
            status: filters.status,
            urgency: filters.urgency,
          },
        },
      ),
    placeholderData: keepPreviousData,
  });
}

export function useReport(reportId: string) {
  return useQuery({
    queryKey: ['reports', reportId],
    queryFn: () =>
      apiFetch<{ data: { report: Report; responses: ReportResponse[] } }>(`/reports/${reportId}`).then(
        (r) => r.data,
      ),
    enabled: Boolean(reportId),
  });
}

export function useRespondToReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { message: string; internal_notes?: string }) =>
      apiFetch<{ data: ReportResponse }>(`/reports/${reportId}/respond`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', reportId] });
      qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
    },
  });
}

export function useFlagReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: { flagged: boolean } }>(`/reports/${reportId}/flag`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', reportId] });
      qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
    },
  });
}

export function useMarkReviewed(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>(`/reports/${reportId}/review`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', reportId] });
      qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
    },
  });
}
