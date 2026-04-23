import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getReport,
  listMyReports,
  submitReport,
  type ReportUrgency,
  type SubmitReportInput,
} from '../lib/reports.api';
import { enqueue, isNetworkError } from '../lib/offlineQueue';

export const reportsKeys = {
  all: ['reports'] as const,
  mine: (urgency?: ReportUrgency) => ['reports', 'mine', urgency ?? 'all'] as const,
  one: (id: string) => ['reports', 'one', id] as const,
};

export function useMyReports(urgency?: ReportUrgency) {
  return useInfiniteQuery({
    queryKey: reportsKeys.mine(urgency),
    initialPageParam: 1 as number,
    queryFn: ({ pageParam }) => listMyReports({ page: pageParam, limit: 20, urgency }),
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.page + 1 : undefined),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: reportsKeys.one(id ?? ''),
    queryFn: () => getReport(id!),
    enabled: !!id,
  });
}

export function useSubmitReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitReportInput) => {
      try {
        return await submitReport(input);
      } catch (err) {
        if (isNetworkError(err)) {
          const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          await enqueue({ kind: 'report-submit', payload: input as unknown as Record<string, unknown>, idempotencyKey });
          return { id: `pending-${Date.now()}`, ...input, status: 'submitted' as const, submitted_at: new Date().toISOString() };
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportsKeys.all });
    },
  });
}
