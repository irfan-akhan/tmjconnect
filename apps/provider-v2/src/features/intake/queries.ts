import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

export type FieldDef = {
  type: 'scale' | 'checkbox' | 'text' | 'select' | 'number';
  label: string;
  options?: string[];
  required: boolean;
  order: number;
  min?: number;
  max?: number;
  placeholder?: string;
};

export type IntakeForm = {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  fields: FieldDef[];
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
};

export type IntakeResponse = {
  id: string;
  patient_id: string;
  patient_name: string;
  answers: Array<{ field_label: string; field_type: string; value: unknown }>;
  submitted_at: string;
};

export function useIntakeForms() {
  return useQuery({
    queryKey: ['intake-forms'],
    queryFn: () => apiFetch<{ data: IntakeForm[] }>('/intake-forms').then((r) => r.data),
  });
}

export function useIntakeForm(formId: string | undefined) {
  return useQuery({
    queryKey: ['intake-forms', formId],
    queryFn: () => apiFetch<{ data: IntakeForm }>(`/intake-forms/${formId}`).then((r) => r.data),
    enabled: !!formId,
  });
}

export function useCreateIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; fields: FieldDef[] }) =>
      apiFetch<{ data: IntakeForm }>('/intake-forms', { method: 'POST', body: input }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake-forms'] });
      toast.success('Form created.');
    },
  });
}

export function useUpdateIntakeForm(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ title: string; description: string | null; fields: FieldDef[]; status: string }>) =>
      apiFetch<{ data: IntakeForm }>(`/intake-forms/${formId}`, { method: 'PATCH', body: input }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake-forms'] });
      toast.success('Form saved.');
    },
  });
}

export function useDeleteIntakeForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formId: string) => apiFetch(`/intake-forms/${formId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake-forms'] });
      toast.success('Form deleted.');
    },
  });
}

export function useAssignIntakeForm(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) =>
      apiFetch(`/intake-forms/${formId}/assign`, { method: 'POST', body: { patient_id: patientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intake-forms'] });
      toast.success('Form assigned.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Assignment failed.'),
  });
}

export function useIntakeResponses(formId: string | undefined) {
  return useQuery({
    queryKey: ['intake-forms', formId, 'responses'],
    queryFn: () => apiFetch<{ data: IntakeResponse[] }>(`/intake-forms/${formId}/responses`).then((r) => r.data),
    enabled: !!formId,
  });
}
