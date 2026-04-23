import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
export function useCreateAssignment(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body) => apiFetch(`/providers/patients/${patientId}/assignments`, {
            method: 'POST',
            body: { ...body, patient_id: patientId },
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
        },
    });
}
export function useUpdateAssignment(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ assignmentId, body }) => apiFetch(`/providers/assignments/${assignmentId}`, {
            method: 'PATCH',
            body,
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
        },
    });
}
export function useDeleteAssignment(patientId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (assignmentId) => apiFetch(`/providers/assignments/${assignmentId}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
        },
    });
}
