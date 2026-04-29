import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { InboxRow } from '@/features/reports/queries';
import type { PatientRow } from '@/features/patients/types';

export type KpiDelta = { value: number | null; pct: number | null };

export type DashboardSummaryResponse = {
  activePatients: number;
  unreadReports: number;
  pendingCodes: number;
  urgentReports: number;
  deltas: {
    activePatients: KpiDelta;
    unreadReports: KpiDelta;
    pendingCodes: KpiDelta;
    urgentReports: KpiDelta;
  };
  recentPatients: Array<{
    patient_id: string;
    first_name: string;
    last_name: string;
    last_symptom_at: string | null;
  }>;
  urgentInbox: InboxRow[];
};

/**
 * Single round-trip dashboard summary. Combines KPI counts, period-over-period
 * deltas, the urgent inbox slice, and recent patients (with daily pain series
 * for the sparklines) — the patient list comes from /providers/patients so
 * each row carries the full PatientRow shape (including daily_pain_14d).
 */
export function useDashboardSummary() {
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () =>
      apiFetch<{ data: DashboardSummaryResponse }>('/providers/dashboard/summary').then(
        (r) => r.data,
      ),
  });

  const patients = useQuery({
    queryKey: ['dashboard', 'patients'],
    queryFn: () =>
      apiFetch<{ data: PatientRow[]; meta: { total: number } }>('/providers/patients', {
        query: { page: 1, limit: 6 },
      }),
  });

  return {
    isLoading: summary.isLoading || patients.isLoading,
    data: {
      activePatients: summary.data?.activePatients ?? 0,
      unreadReports: summary.data?.unreadReports ?? 0,
      pendingCodes: summary.data?.pendingCodes ?? 0,
      urgentReports: summary.data?.urgentReports ?? 0,
      deltas: summary.data?.deltas,
      urgentInbox: summary.data?.urgentInbox ?? [],
      recentPatients: patients.data?.data ?? [],
    },
  };
}

/**
 * Lightweight standalone hook for the sidebar badge — doesn't pull the
 * whole dashboard payload.
 */
export function useUnreadReportsCount() {
  return useQuery({
    queryKey: ['dashboard', 'unread-reports', 'count'],
    queryFn: () =>
      apiFetch<{ data: unknown[]; meta: { total: number } }>('/reports/inbox', {
        query: { page: 1, limit: 1, status: 'submitted' },
      }).then((r) => r.meta.total),
    refetchInterval: 60_000,
  });
}
