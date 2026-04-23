import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function usePatientDetail(patientId) {
    return useQuery({
        queryKey: ['patient', patientId],
        queryFn: () => apiFetch(`/providers/patients/${patientId}`).then((r) => r.data),
        enabled: Boolean(patientId),
    });
}
export function usePatientSymptoms(patientId) {
    return useInfiniteQuery({
        queryKey: ['patient', patientId, 'symptoms'],
        queryFn: ({ pageParam }) => apiFetch(`/providers/patients/${patientId}/symptoms`, {
            query: { limit: 20, cursor: pageParam || undefined },
        }),
        initialPageParam: '',
        getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor ?? undefined : undefined),
        enabled: Boolean(patientId),
    });
}
export function usePatientAssignments(patientId) {
    return useQuery({
        queryKey: ['patient', patientId, 'assignments'],
        queryFn: () => apiFetch(`/providers/patients/${patientId}/assignments`).then((r) => r.data),
        enabled: Boolean(patientId),
    });
}
export function usePatientReports(patientId, page = 1) {
    return useQuery({
        queryKey: ['patient', patientId, 'reports', page],
        queryFn: () => apiFetch(`/providers/patients/${patientId}/reports`, { query: { page, limit: 20 } }),
        enabled: Boolean(patientId),
    });
}
