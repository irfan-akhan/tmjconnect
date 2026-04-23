import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyIntakeAssignments, submitIntakeResponse, type IntakeAssignment } from '../lib/intake.api';
import { enqueue, isNetworkError } from '../lib/offlineQueue';

export function useMyIntakeAssignments() {
  return useQuery({
    queryKey: ['intake', 'assignments'],
    queryFn: getMyIntakeAssignments,
  });
}

export function useSubmitIntakeResponse(formId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answers: Array<{ field_label: string; field_type: string; value: unknown }>) => {
      try {
        return await submitIntakeResponse(formId, answers);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'intake-response', formId, payload: { answers } });
          return { id: `pending-${Date.now()}` };
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake'] }),
  });
}
