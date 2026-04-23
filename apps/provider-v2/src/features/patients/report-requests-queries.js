import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
export function usePatientReportRequests(patientId) {
    return useQuery({
        queryKey: ['patient', patientId, 'report-requests'],
        queryFn: () => apiFetch(`/providers/patients/${patientId}/report-requests`).then((r) => r.data),
        enabled: Boolean(patientId),
    });
}
export function useCreateReportRequest(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/providers/patients/${patientId}/report-requests`, {
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
export function useDismissReportRequest(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/reports/requests/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'report-requests'] });
            toast.success('Request dismissed.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to dismiss.'),
    });
}
export function useProviderCreateReport(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/providers/patients/${patientId}/reports`, {
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
