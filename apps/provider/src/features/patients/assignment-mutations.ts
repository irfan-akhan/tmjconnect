import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type AssignmentStatus = 'active' | 'paused' | 'completed';

export type CreateAssignmentBody = {
  exercise_id: string;
  patient_id: string;
  frequency: string;
  sets: number;
};

export type UpdateAssignmentBody = Partial<{
  frequency: string;
  sets: number;
  status: AssignmentStatus;
}>;

export function useCreateAssignment(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<CreateAssignmentBody, 'patient_id'>) =>
      apiFetch<{ data: unknown }>(`/providers/patients/${patientId}/assignments`, {
        method: 'POST',
        body: { ...body, patient_id: patientId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
    },
  });
}

export function useUpdateAssignment(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, body }: { assignmentId: string; body: UpdateAssignmentBody }) =>
      apiFetch<{ data: unknown }>(`/providers/assignments/${assignmentId}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
    },
  });
}

export function useDeleteAssignment(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<null>(`/providers/assignments/${assignmentId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId, 'assignments'] });
    },
  });
}
