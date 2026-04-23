import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function useExercises(params) {
    return useQuery({
        queryKey: ['exercises', params],
        queryFn: () => apiFetch('/providers/exercises', {
            query: {
                page: params.page,
                limit: params.limit,
                category: params.category || undefined,
            },
        }),
        placeholderData: keepPreviousData,
    });
}
export function useCreateExercise() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch('/providers/exercises', { method: 'POST', body }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
    });
}
export function useUpdateExercise(id) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/providers/exercises/${id}`, { method: 'PATCH', body }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
    });
}
export function useDeleteExercise() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/providers/exercises/${id}`, { method: 'DELETE' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
    });
}
export async function uploadVideo(file) {
    const form = new FormData();
    form.append('file', file);
    // apiFetch forces JSON content-type; hit fetch directly for multipart.
    const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
    const res = await fetch(`${BASE_URL}/uploads/video`, {
        method: 'POST',
        credentials: 'include',
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `Upload failed (${res.status})`);
    }
    const payload = await res.json();
    return payload.data;
}
