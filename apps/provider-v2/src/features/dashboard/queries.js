import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
/**
 * Dashboard aggregates several endpoints client-side. The backend has no
 * /dashboard/summary route yet — for now we fan out to the existing queries.
 */
export function useDashboardSummary() {
    const patients = useQuery({
        queryKey: ['dashboard', 'patients'],
        queryFn: () => apiFetch('/providers/patients', {
            query: { page: 1, limit: 5 },
        }),
    });
    const unread = useQuery({
        queryKey: ['dashboard', 'unread-reports'],
        queryFn: () => apiFetch('/reports/inbox', {
            query: { page: 1, limit: 5, status: 'submitted' },
        }),
    });
    const urgent = useQuery({
        queryKey: ['dashboard', 'urgent-reports'],
        queryFn: () => apiFetch('/reports/inbox', {
            query: { page: 1, limit: 5, urgency: 'urgent' },
        }),
    });
    const codes = useQuery({
        queryKey: ['linking', 'codes'],
        queryFn: () => apiFetch('/linking/codes').then((r) => r.data),
    });
    return {
        isLoading: patients.isLoading || unread.isLoading || codes.isLoading,
        data: {
            activePatients: patients.data?.meta.total ?? 0,
            unreadReports: unread.data?.meta.total ?? 0,
            pendingCodes: (codes.data ?? []).filter((c) => c.status === 'pending').length,
            urgentInbox: urgent.data?.data ?? [],
            recentPatients: patients.data?.data ?? [],
        },
    };
}
/**
 * Lightweight standalone hook for the sidebar badge — doesn't pull the
 * whole dashboard payload.
 */
export function useUnreadReportsCount() {
    return useQuery({
        queryKey: ['dashboard', 'unread-reports', 'count'],
        queryFn: () => apiFetch('/reports/inbox', {
            query: { page: 1, limit: 1, status: 'submitted' },
        }).then((r) => r.meta.total),
        refetchInterval: 60_000,
    });
}
