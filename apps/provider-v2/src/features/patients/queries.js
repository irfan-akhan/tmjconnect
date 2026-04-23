import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function usePatients(params) {
    return useQuery({
        queryKey: ['patients', params],
        queryFn: () => apiFetch('/providers/patients', {
            query: {
                page: params.page,
                limit: params.limit,
                search: params.search || undefined,
            },
        }),
        placeholderData: keepPreviousData,
    });
}
