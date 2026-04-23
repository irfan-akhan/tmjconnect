import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function useLinkingCodes() {
    return useQuery({
        queryKey: ['linking', 'codes'],
        queryFn: () => apiFetch('/linking/codes').then((r) => r.data),
    });
}
export function useLinks() {
    return useQuery({
        queryKey: ['linking', 'links'],
        queryFn: () => apiFetch('/linking/links').then((r) => r.data),
    });
}
export function useGenerateCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => apiFetch('/linking/codes', { method: 'POST' }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['linking', 'codes'] }),
    });
}
export function useEmailInvite() {
    return useMutation({
        mutationFn: ({ code, patient_email, patient_name }) => apiFetch(`/linking/codes/${code}/invite`, {
            method: 'POST',
            body: { patient_email, patient_name: patient_name || undefined },
        }),
    });
}
export function useDisconnectLink() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (linkId) => apiFetch(`/linking/links/${linkId}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['linking'] });
            qc.invalidateQueries({ queryKey: ['patients'] });
        },
    });
}
