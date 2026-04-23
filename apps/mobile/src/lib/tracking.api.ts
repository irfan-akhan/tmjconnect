import { api } from './api';

// ─── Insights ─────────────────────────────────────────────────────────────

export type PainInsights = {
  daily_averages: { date: string; avg_pain: number; count: number }[];
  day_of_week: { day: number; avg_pain: number; count: number }[];
  trigger_frequency: { trigger: string; count: number }[];
  pain_type_frequency: { type: string; count: number }[];
  overall: { avg_pain: number; total_logs: number; trend: number };
};

export type ExerciseCorrelation = {
  exercise_days_avg_pain: number;
  exercise_days_count: number;
  no_exercise_days_avg_pain: number;
  no_exercise_days_count: number;
};

export async function getPainInsights(days = 30): Promise<PainInsights> {
  const res = await api.get<{ data: PainInsights }>('/symptoms/insights', { query: { days } });
  return res.data;
}

export async function getExerciseCorrelation(days = 30): Promise<ExerciseCorrelation> {
  const res = await api.get<{ data: ExerciseCorrelation }>('/symptoms/correlation', { query: { days } });
  return res.data;
}

// ─── Jaw Mobility ─────────────────────────────────────────────────────────

export type MobilityLog = {
  id: string;
  measurement_mm: number;
  method: string;
  notes: string | null;
  logged_at: string;
  created_at: string;
};

export type MobilityTrendPoint = { date: string; avg_mm: number; count: number };

export async function logMobility(input: { measurement_mm: number; method?: string; notes?: string }): Promise<MobilityLog> {
  const res = await api.post<{ data: MobilityLog }>('/tracking/mobility', input);
  return res.data;
}

export async function getMobilityLogs(limit = 20, cursor?: string): Promise<{ data: MobilityLog[]; meta: { nextCursor: string | null; hasMore: boolean } }> {
  return api.get('/tracking/mobility', { query: { limit, cursor } });
}

export async function getMobilityTrend(days = 60): Promise<MobilityTrendPoint[]> {
  const res = await api.get<{ data: MobilityTrendPoint[] }>('/tracking/mobility/trend', { query: { days } });
  return res.data;
}

// ─── Medications ──────────────────────────────────────────────────────────

export type MedicationLog = {
  id: string;
  medication_name: string;
  dosage: string | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
};

export type MedicationCorrelation = {
  medication_days_avg_pain: number;
  medication_days_count: number;
  no_medication_days_avg_pain: number;
  no_medication_days_count: number;
};

export async function logMedication(input: { medication_name: string; dosage?: string; notes?: string }): Promise<MedicationLog> {
  const res = await api.post<{ data: MedicationLog }>('/tracking/medications', input);
  return res.data;
}

export async function getMedicationLogs(limit = 20, cursor?: string): Promise<{ data: MedicationLog[]; meta: { nextCursor: string | null; hasMore: boolean } }> {
  return api.get('/tracking/medications', { query: { limit, cursor } });
}

export async function getMedicationCorrelation(days = 30): Promise<MedicationCorrelation> {
  const res = await api.get<{ data: MedicationCorrelation }>('/tracking/medications/correlation', { query: { days } });
  return res.data;
}

// ─── Sleep ────────────────────────────────────────────────────────────────

export type SleepLog = {
  id: string;
  quality: number;
  hours_slept: string | null;
  bruxism_aware: boolean;
  morning_stiffness: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
};

export type SleepCorrelationBucket = { quality: string; avg_pain: number; days: number };

export async function logSleep(input: {
  quality: number;
  hours_slept?: number;
  bruxism_aware?: boolean;
  morning_stiffness?: number;
  notes?: string;
}): Promise<SleepLog> {
  const res = await api.post<{ data: SleepLog }>('/tracking/sleep', input);
  return res.data;
}

export async function getSleepLogs(limit = 20, cursor?: string): Promise<{ data: SleepLog[]; meta: { nextCursor: string | null; hasMore: boolean } }> {
  return api.get('/tracking/sleep', { query: { limit, cursor } });
}

export async function getSleepCorrelation(days = 30): Promise<SleepCorrelationBucket[]> {
  const res = await api.get<{ data: SleepCorrelationBucket[] }>('/tracking/sleep/correlation', { query: { days } });
  return res.data;
}
