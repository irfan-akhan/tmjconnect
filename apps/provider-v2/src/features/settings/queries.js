import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
export async function uploadAvatar(file) {
    const form = new FormData();
    form.append('file', file);
    const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
    const res = await fetch(`${BASE_URL}/uploads/avatar`, {
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
export function useProfile() {
    return useQuery({
        queryKey: ['profile'],
        queryFn: () => apiFetch('/providers/me').then((r) => r.data),
    });
}
export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch('/providers/me', {
            method: 'PATCH',
            body,
        }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Profile save failed.'),
    });
}
export function useSessions() {
    return useQuery({
        queryKey: ['sessions'],
        queryFn: () => apiFetch('/providers/me/sessions').then((r) => r.data),
    });
}
export function useActivity(limit = 20) {
    return useQuery({
        queryKey: ['activity', limit],
        queryFn: () => apiFetch('/providers/me/activity', {
            query: { limit },
        }).then((r) => r.data),
    });
}
export function useRevokeSession() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/providers/me/sessions/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['sessions'] });
            toast.success('Session revoked.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to revoke session.'),
    });
}
