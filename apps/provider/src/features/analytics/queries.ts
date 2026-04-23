import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type ProviderAnalytics = {
  overview: {
    total_patients: number;
    active_patients_7d: number;
    avg_pain_level: number;
    avg_pain_trend: number;
    total_logs_30d: number;
    exercise_compliance_pct: number;
  };
  pain_trend: Array<{ date: string; avg_pain: number; log_count: number }>;
  trigger_distribution: Array<{ trigger: string; count: number; pct: number }>;
  patient_engagement: Array<{
    patient_id: string;
    first_name: string;
    last_name: string;
    logs_30d: number;
    avg_pain: number;
    pain_delta: number;
    last_log_at: string | null;
    exercises_completed_30d: number;
  }>;
  pain_distribution: Array<{ level: number; count: number }>;
  exercise_impact: {
    with_exercise_avg_pain: number;
    without_exercise_avg_pain: number;
    with_exercise_days: number;
    without_exercise_days: number;
  };
  day_of_week_pattern: Array<{ day: string; avg_pain: number; log_count: number }>;
};

export function useProviderAnalytics(days: number) {
  return useQuery({
    queryKey: ['provider', 'analytics', days],
    queryFn: () =>
      apiFetch<{ data: ProviderAnalytics }>('/providers/analytics', {
        query: { days },
      }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}
