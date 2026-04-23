import { useQuery } from '@tanstack/react-query';
import api from '../config/api';

export type PlatformAnalytics = {
  user_growth: Array<{ date: string; patients: number; providers: number }>;
  pain_overview: { avg_pain: number; total_logs: number; active_loggers: number };
  pain_trend: Array<{ date: string; avg_pain: number; log_count: number }>;
  pain_distribution: Array<{ level: number; count: number }>;
  top_triggers: Array<{ trigger: string; count: number; pct: number }>;
  report_volume: Array<{ date: string; total: number; urgent: number; concerning: number; routine: number }>;
  response_times: Array<{ date: string; avg_hours: number }>;
  exercise_stats: { total_exercises: number; total_assignments: number; completion_rate: number };
  engagement_funnel: { total_users: number; verified: number; with_profile: number; active_7d: number; active_30d: number };
  provider_workload: Array<{ provider_id: string; name: string; patient_count: number; reports_30d: number; avg_response_hours: number | null }>;
};

export function useAdminAnalytics(days: number) {
  return useQuery({
    queryKey: ['admin', 'analytics', days],
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/admin/analytics', { params: { days }, signal });
      return data.data as PlatformAnalytics;
    },
    staleTime: 5 * 60_000,
  });
}
