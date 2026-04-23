import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type ClinicalNote = {
  id: string;
  patient_id: string;
  provider_id: string | null;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export function usePatientNotes(patientId: string, page = 1) {
  return useQuery({
    queryKey: ['patient', patientId, 'notes', page],
    queryFn: () =>
      apiFetch<{ data: ClinicalNote[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        `/providers/patients/${patientId}/notes`,
        { query: { page, limit: 20 } },
      ),
    placeholderData: keepPreviousData,
    enabled: Boolean(patientId),
  });
}

export function useCreateNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; tags: string[] }) =>
      apiFetch<{ data: ClinicalNote }>(`/providers/patients/${patientId}/notes`, {
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

export function useUpdateNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body, tags }: { id: string; body?: string; tags?: string[] }) =>
      apiFetch<{ data: ClinicalNote }>(`/providers/notes/${id}`, {
        method: 'PATCH',
        body: { body, tags },
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] }),
  });
}

export function useDeleteNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/providers/notes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'notes'] });
      toast.success('Note deleted.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed.'),
  });
}
