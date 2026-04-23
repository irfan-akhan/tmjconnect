import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
export function useIntakeForms() {
    return useQuery({
        queryKey: ['intake-forms'],
        queryFn: () => apiFetch('/intake-forms').then((r) => r.data),
    });
}
export function useIntakeForm(formId) {
    return useQuery({
        queryKey: ['intake-forms', formId],
        queryFn: () => apiFetch(`/intake-forms/${formId}`).then((r) => r.data),
        enabled: !!formId,
    });
}
export function useCreateIntakeForm() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch('/intake-forms', { method: 'POST', body: input }).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['intake-forms'] });
            toast.success('Form created.');
        },
    });
}
export function useUpdateIntakeForm(formId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (input) => apiFetch(`/intake-forms/${formId}`, { method: 'PATCH', body: input }).then((r) => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['intake-forms'] });
            toast.success('Form saved.');
        },
    });
}
export function useDeleteIntakeForm() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (formId) => apiFetch(`/intake-forms/${formId}`, { method: 'DELETE' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['intake-forms'] });
            toast.success('Form deleted.');
        },
    });
}
export function useAssignIntakeForm(formId) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (patientId) => apiFetch(`/intake-forms/${formId}/assign`, { method: 'POST', body: { patient_id: patientId } }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['intake-forms'] });
            toast.success('Form assigned.');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Assignment failed.'),
    });
}
export function useIntakeResponses(formId) {
    return useQuery({
        queryKey: ['intake-forms', formId, 'responses'],
        queryFn: () => apiFetch(`/intake-forms/${formId}/responses`).then((r) => r.data),
        enabled: !!formId,
    });
}
