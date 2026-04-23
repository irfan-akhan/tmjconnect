import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type ReportRequestStatus = 'pending' | 'fulfilled' | 'dismissed';

export type ReportRequest = {
  id: string;
  provider_id: string | null;
  patient_id: string;
  prompt: string;
  status: ReportRequestStatus;
  fulfilled_report_id: string | null;
  fulfilled_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export function usePatientReportRequests(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId, 'report-requests'],
    queryFn: () =>
      apiFetch<{ data: ReportRequest[] }>(
        `/providers/patients/${patientId}/report-requests`,
      ).then((r) => r.data),
    enabled: Boolean(patientId),
  });
}

export function useCreateReportRequest(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { prompt: string }) =>
      apiFetch<{ data: ReportRequest }>(`/providers/patients/${patientId}/report-requests`, {
        method: 'POST',
        body,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'report-requests'] });
      toast.success('Request sent to patient.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to send request.'),
  });
}

export function useDismissReportRequest(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/reports/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'report-requests'] });
      toast.success('Request dismissed.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to dismiss.'),
  });
}

export type ProviderCreateReportBody = {
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level?: number | null;
  description: string;
  photo_url?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  patient_notes?: string | null;
  fulfilling_request_id?: string;
};

export function useProviderCreateReport(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProviderCreateReportBody) =>
      apiFetch<{ data: { id: string } }>(`/providers/patients/${patientId}/reports`, {
        method: 'POST',
        body,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'reports'] });
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'report-requests'] });
      qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
      toast.success('Report filed on patient\'s behalf.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to file report.'),
  });
}
