import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function useProviderAnalytics(days) {
    return useQuery({
        queryKey: ['provider', 'analytics', days],
        queryFn: () => apiFetch('/providers/analytics', {
            query: { days },
        }).then((r) => r.data),
        staleTime: 5 * 60_000,
    });
}
