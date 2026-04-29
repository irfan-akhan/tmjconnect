import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type TosStatus = {
  current_version: string;
  published_at: string;
  accepted: boolean;
  accepted_version: string | null;
  accepted_at: string | null;
};

export function useTosStatus() {
  return useQuery({
    queryKey: ['tos-status'],
    queryFn: () =>
      apiFetch<{ data: TosStatus }>('/auth/tos/current').then((r) => r.data),
  });
}

export function useAcceptTos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: string) =>
      apiFetch<{ message: string }>('/auth/tos/accept', {
        method: 'POST',
        body: { version },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tos-status'] });
      toast.success('Terms of Service accepted.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to record acceptance.'),
  });
}
