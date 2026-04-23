import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSymptomLog,
  getRecentSymptoms,
  updateSymptomLog,
  upsertSymptomLog,
  type SymptomLog,
  type SymptomLogInput,
  type SymptomLogUpdate,
} from '../lib/patient.api';
import { api } from '../lib/api';
import { deleteSymptomLog } from '../lib/symptoms.api';
import { enqueue, isNetworkError } from '../lib/offlineQueue';
import { qk } from './usePatient';

/** Infinite-scroll list of past logs, cursor = last logged_at. */
export function useSymptomHistory(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ['symptoms', 'history', pageSize] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api.get<{
        data: SymptomLog[];
        meta: { nextCursor: string | null; hasMore: boolean };
      }>('/symptoms', {
        query: { limit: pageSize, cursor: pageParam },
      });
      return res;
    },
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor ?? undefined : undefined),
  });
}

export function useSymptomLog(id: string | undefined) {
  return useQuery({
    queryKey: ['symptoms', 'one', id],
    queryFn: () => getSymptomLog(id!),
    enabled: !!id,
  });
}

export function useUpsertSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SymptomLogInput) => {
      try {
        return await upsertSymptomLog(input);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'symptom-upsert', payload: input });
          // Return a synthetic log so the UI can still dismiss. When the
          // drain runs, the real server record will replace it in cache.
          return {
            id: `pending-${Date.now()}`,
            patient_id: 'pending',
            pain_level: input.pain_level,
            pain_types: input.pain_types ?? [],
            body_areas: input.body_areas ?? [],
            duration_minutes: input.duration_minutes ?? null,
            triggers: input.triggers ?? [],
            notes: input.notes ?? '',
            logged_at: input.logged_at ?? new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as SymptomLog;
        }
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symptoms'] });
      qc.invalidateQueries({ queryKey: qk.symptomStats });
      qc.invalidateQueries({ queryKey: qk.recentSymptoms(7) });
    },
  });
}

export function useUpdateSymptom(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SymptomLogUpdate) => updateSymptomLog(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symptoms'] });
      qc.invalidateQueries({ queryKey: qk.symptomStats });
      qc.invalidateQueries({ queryKey: qk.recentSymptoms(7) });
    },
  });
}

export function useDeleteSymptom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSymptomLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['symptoms'] });
      qc.invalidateQueries({ queryKey: qk.symptomStats });
      qc.invalidateQueries({ queryKey: qk.recentSymptoms(7) });
    },
  });
}

/** Returns today's existing log (if any) by looking at the most recent log. */
export function useTodaysLog() {
  const recent = useQuery({
    queryKey: ['symptoms', 'today'],
    queryFn: () => getRecentSymptoms(1),
  });
  const today = recent.data?.[0];
  const loggedToday = today && isSameLocalDay(new Date(today.logged_at), new Date());
  return {
    ...recent,
    data: loggedToday ? today : undefined,
  };
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
