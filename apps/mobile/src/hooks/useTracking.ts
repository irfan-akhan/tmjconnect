import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPainInsights, getExerciseCorrelation,
  logMobility, getMobilityTrend,
  logMedication, getMedicationCorrelation,
  logSleep, getSleepCorrelation,
  type PainInsights, type ExerciseCorrelation,
} from '../lib/tracking.api';
import { enqueue, isNetworkError } from '../lib/offlineQueue';

export function usePainInsights(days = 30) {
  return useQuery({
    queryKey: ['insights', 'pain', days],
    queryFn: () => getPainInsights(days),
  });
}

export function useExerciseCorrelation(days = 30) {
  return useQuery({
    queryKey: ['insights', 'exercise-correlation', days],
    queryFn: () => getExerciseCorrelation(days),
  });
}

export function useMobilityTrend(days = 60) {
  return useQuery({
    queryKey: ['tracking', 'mobility-trend', days],
    queryFn: () => getMobilityTrend(days),
  });
}

export function useLogMobility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { measurement_mm: number; method?: string; notes?: string }) => {
      try {
        return await logMobility(input);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'mobility-log', payload: input });
          return { id: `pending-${Date.now()}`, ...input, logged_at: new Date().toISOString(), created_at: new Date().toISOString() };
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking', 'mobility-trend'] }),
  });
}

export function useMedicationCorrelation(days = 30) {
  return useQuery({
    queryKey: ['tracking', 'medication-correlation', days],
    queryFn: () => getMedicationCorrelation(days),
  });
}

export function useLogMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { medication_name: string; dosage?: string; notes?: string }) => {
      try {
        return await logMedication(input);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'medication-log', payload: input });
          return { id: `pending-${Date.now()}`, ...input, logged_at: new Date().toISOString(), created_at: new Date().toISOString() };
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking'] }),
  });
}

export function useSleepCorrelation(days = 30) {
  return useQuery({
    queryKey: ['tracking', 'sleep-correlation', days],
    queryFn: () => getSleepCorrelation(days),
  });
}

export function useLogSleep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { quality: number; hours_slept?: number; bruxism_aware?: boolean; morning_stiffness?: number; notes?: string }) => {
      try {
        return await logSleep(input);
      } catch (err) {
        if (isNetworkError(err)) {
          await enqueue({ kind: 'sleep-log', payload: input });
          return { id: `pending-${Date.now()}`, ...input, logged_at: new Date().toISOString(), created_at: new Date().toISOString() };
        }
        throw err;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tracking'] }),
  });
}
