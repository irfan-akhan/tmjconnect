import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeAssignment } from '../lib/exercises.api';
import { enqueue, isNetworkError } from '../lib/offlineQueue';
import { qk } from './usePatient';

export function useCompleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { assignmentId: string; duration_seconds?: number; notes?: string }) => {
      const payload = {
        completion_duration_seconds: params.duration_seconds,
        completion_notes: params.notes,
      };
      try {
        return await completeAssignment(params.assignmentId, payload);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'exercise-complete', assignmentId: params.assignmentId, payload });
          return {
            completion: {
              id: `pending-${Date.now()}`,
              assignment_id: params.assignmentId,
              patient_id: 'pending',
              completed_at: new Date().toISOString(),
            },
            alreadyCompleted: false,
            queuedOffline: true,
          };
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.assignments });
    },
  });
}
