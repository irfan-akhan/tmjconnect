import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function useInbox(filters) {
    return useQuery({
        queryKey: ['reports', 'inbox', filters],
        queryFn: () => apiFetch('/reports/inbox', {
            query: {
                page: filters.page,
                limit: filters.limit,
                status: filters.status,
                urgency: filters.urgency,
            },
        }),
        placeholderData: keepPreviousData,
    });
}
export function useReport(reportId) {
    return useQuery({
        queryKey: ['reports', reportId],
        queryFn: () => apiFetch(`/reports/${reportId}`).then((r) => r.data),
        enabled: Boolean(reportId),
    });
}
export function useRespondToReport(reportId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/reports/${reportId}/respond`, {
            method: 'POST',
            body,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['reports', reportId] });
            qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
        },
    });
}
export function useFlagReport(reportId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiFetch(`/reports/${reportId}/flag`, { method: 'PATCH' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['reports', reportId] });
            qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
        },
    });
}
export function useMarkReviewed(reportId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiFetch(`/reports/${reportId}/review`, { method: 'PATCH' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['reports', reportId] });
            qc.invalidateQueries({ queryKey: ['reports', 'inbox'] });
        },
    });
}
