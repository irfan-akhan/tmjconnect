import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
export function usePatientNotes(patientId, page = 1) {
    return useQuery({
        queryKey: ['patient', patientId, 'notes', page],
        queryFn: () => apiFetch(`/providers/patients/${patientId}/notes`, { query: { page, limit: 20 } }),
        placeholderData: keepPreviousData,
        enabled: Boolean(patientId),
    });
}
export function useCreateNote(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/providers/patients/${patientId}/notes`, {
            method: 'POST',
            body,
        }).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] });
            toast.success('Note saved.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed.'),
    });
}
export function useUpdateNote(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body, tags }) => apiFetch(`/providers/notes/${id}`, {
            method: 'PATCH',
            body: { body, tags },
        }).then((r) => r.data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] }),
    });
}
export function useDeleteNote(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id) => apiFetch(`/providers/notes/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] });
            toast.success('Note deleted.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed.'),
    });
}
