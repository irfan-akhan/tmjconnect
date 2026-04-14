/**
 * queries.ts — React Query hooks for every admin API endpoint.
 *
 * Centralising queries here gives us:
 *   - automatic request dedup (Dashboard + Settings share /admin/stats)
 *   - stale-while-revalidate (pages show cached data instantly, refresh in bg)
 *   - window-focus refetch (replaces useAutoRefresh for most use-cases)
 *   - AbortController per query (StrictMode double-mounts cancel properly)
 *   - consistent error / loading states
 *
 * Each hook wraps `useQuery` with the right key, fetcher, and staleTime so
 * consuming pages are one-liners.
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '../config/api';

// ─── Key factories ──────────────────────────────────────────────────────
// Structured keys make cache invalidation surgical.
export const queryKeys = {
  stats: ['admin', 'stats'] as const,
  users: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
  userDetail: (id: string) => ['admin', 'users', id] as const,
  auditLogs: (params: Record<string, unknown>) => ['admin', 'audit-logs', params] as const,
  loginEvents: (params: Record<string, unknown>) => ['admin', 'login-events', params] as const,
  reports: (params: Record<string, unknown>) => ['admin', 'reports', params] as const,
};

// ─── /admin/stats ───────────────────────────────────────────────────────
interface Stats {
  total_users: number;
  patients: number;
  providers: number;
  active_users: number;
  reports_today: number;
  avg_response_hours: number | null;
  // TODO #4: urgent reports alert (optional — endpoint returns when backend is deployed)
  urgent_reports_waiting?: number;
  urgent_reports_waiting_critical?: number;
  pending_reports_total?: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/admin/stats', { signal });
      return data.data as Stats;
    },
    staleTime: 60_000, // 1 min — dashboard + settings share without re-fetch
    refetchOnWindowFocus: true,
  });
}

// ─── /admin/users ───────────────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; hasMore: boolean };
}

export function useAdminUsers(
  params: Record<string, string | number | boolean>,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PaginatedResponse<UserRow>>('/admin/users', {
        params,
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval,
  });
}

// ─── /admin/users/:id ───────────────────────────────────────────────────
interface UserDetail {
  user: UserRow & { timezone: string | null };
  recent_audit_logs: {
    items: { id: string; action: string; resource_type: string; created_at: string }[];
  };
  recent_login_events: {
    items: {
      id: string;
      success: boolean;
      ip_address: string;
      device_info: string;
      created_at: string;
    }[];
  };
}

export function useAdminUserDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.userDetail(id ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await api.get(`/admin/users/${id}`, { signal });
      return data.data as UserDetail;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── /admin/audit-logs ──────────────────────────────────────────────────
interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string;
  created_at: string;
}

export function useAdminAuditLogs(params: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.auditLogs(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', {
        params,
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

// ─── /admin/login-events ────────────────────────────────────────────────
interface LoginEvent {
  id: string;
  user_id: string | null;
  email: string;
  success: boolean;
  ip_address: string;
  device_info: string;
  failure_reason: string | null;
  created_at: string;
}

export function useAdminLoginEvents(params: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.loginEvents(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PaginatedResponse<LoginEvent>>('/admin/login-events', {
        params,
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

// ─── /admin/reports ─────────────────────────────────────────────────────
interface Report {
  id: string;
  patient_name: string;
  provider_name: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level: number;
  status: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  flagged: boolean;
  submitted_at: string;
}

export function useAdminReports(params: Record<string, string | number>) {
  return useQuery({
    queryKey: queryKeys.reports(params),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PaginatedResponse<Report>>('/admin/reports', {
        params,
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
