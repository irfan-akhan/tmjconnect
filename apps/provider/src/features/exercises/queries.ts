import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type Exercise = {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  category: string | null;
  instructions: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ExerciseInput = {
  title: string;
  description?: string | null;
  duration_seconds?: number | null;
  category?: string | null;
  instructions?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
};

export type ExerciseListParams = { page: number; limit: number; category?: string };

export function useExercises(params: ExerciseListParams) {
  return useQuery({
    queryKey: ['exercises', params],
    queryFn: () =>
      apiFetch<{ data: Exercise[]; meta: { page: number; limit: number; total: number; totalPages: number } }>(
        '/providers/exercises',
        {
          query: {
            page: params.page,
            limit: params.limit,
            category: params.category || undefined,
          },
        },
      ),
    placeholderData: keepPreviousData,
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ExerciseInput) =>
      apiFetch<{ data: Exercise }>('/providers/exercises', { method: 'POST', body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useUpdateExercise(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<ExerciseInput>) =>
      apiFetch<{ data: Exercise }>(`/providers/exercises/${id}`, { method: 'PATCH', body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/providers/exercises/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export async function uploadVideo(file: File): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const payload = await apiFetch<{ data: { key: string; url: string } }>('/uploads/video', {
    method: 'POST',
    body: form,
  });
  return payload.data;
}
