import { api } from './api';

export type ExerciseCompletion = {
  id: string;
  assignment_id: string;
  patient_id: string;
  completed_at: string;
};

export async function completeAssignment(
  assignmentId: string,
  input: { completion_duration_seconds?: number; completion_notes?: string } = {},
): Promise<{ completion: ExerciseCompletion; alreadyCompleted: boolean }> {
  const res = await api.post<{ data: ExerciseCompletion; alreadyCompleted: boolean }>(
    `/exercises/assignments/${assignmentId}/complete`,
    input,
  );
  return { completion: res.data, alreadyCompleted: res.alreadyCompleted };
}
