/**
 * todoQueries.ts — React Query hooks for all TODO.md admin endpoints (#1–#15).
 *
 * Every hook passes `signal` for AbortController support and uses
 * `keepPreviousData` for smooth pagination. Stale times are tuned per
 * endpoint — polling-style dashboards get shorter windows.
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '../config/api';

// ─── Key factories ──────────────────────────────────────────────────────
export const todoKeys = {
  outboxStats: ['admin', 'outbox', 'stats'] as const,
  outboxDlq: (p: Record<string, unknown>) => ['admin', 'outbox', 'dlq', p] as const,
  outboxPending: (p: Record<string, unknown>) => ['admin', 'outbox', 'pending', p] as const,
  sessions: (p: Record<string, unknown>) => ['admin', 'sessions', p] as const,
  jobs: ['admin', 'jobs'] as const,
  jobHistory: (name: string, p: Record<string, unknown>) => ['admin', 'jobs', name, p] as const,
  providerPerf: (p: Record<string, unknown>) => ['admin', 'providers', 'perf', p] as const,
  patientEngagement: (p: Record<string, unknown>) => ['admin', 'patients', 'engagement', p] as const,
  security: (w: string) => ['admin', 'security', w] as const,
  linkingSummary: ['admin', 'linking', 'summary'] as const,
  linkingCodes: (p: Record<string, unknown>) => ['admin', 'linking', 'codes', p] as const,
  linkingLinks: (p: Record<string, unknown>) => ['admin', 'linking', 'links', p] as const,
  phiByActor: (p: Record<string, unknown>) => ['admin', 'phi', 'actor', p] as const,
  phiByResource: (p: Record<string, unknown>) => ['admin', 'phi', 'resource', p] as const,
  phiAnomalies: (w: string) => ['admin', 'phi', 'anomalies', w] as const,
  notifPrefs: ['admin', 'notif', 'prefs'] as const,
  search: (q: string) => ['admin', 'search', q] as const,
  broadcasts: (p: Record<string, unknown>) => ['admin', 'broadcasts', p] as const,
  systemMetrics: ['admin', 'system', 'metrics'] as const,
  scheduledReports: (p: Record<string, unknown>) => ['admin', 'scheduled-reports', p] as const,
  featureFlags: ['admin', 'feature-flags'] as const,
};

// ═══ #1: Outbox ═══════════════════════════════════════════════════════════

export function useOutboxStats() {
  return useQuery({
    queryKey: todoKeys.outboxStats,
    queryFn: ({ signal }) => api.get('/admin/outbox/stats', { signal }).then((r) => r.data.data),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useOutboxDlq(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.outboxDlq(params),
    queryFn: ({ signal }) => api.get('/admin/outbox/dlq', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useOutboxPending(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.outboxPending(params),
    queryFn: ({ signal }) => api.get('/admin/outbox/pending', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useRetryOutbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/outbox/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'outbox'] });
    },
  });
}

export function useDropOutbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/outbox/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'outbox'] });
    },
  });
}

// ═══ #2: Sessions ═════════════════════════════════════════════════════════

export function useActiveSessions(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.sessions(params),
    queryFn: ({ signal }) => api.get('/admin/sessions/active', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useTerminateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sessions'] });
    },
  });
}

// ═══ #3: Jobs ═════════════════════════════════════════════════════════════

export function useJobSummaries() {
  return useQuery({
    queryKey: todoKeys.jobs,
    queryFn: ({ signal }) => api.get('/admin/jobs', { signal }).then((r) => r.data.data),
    staleTime: 30_000,
  });
}

export function useJobHistory(name: string, params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.jobHistory(name, params),
    queryFn: ({ signal }) => api.get(`/admin/jobs/${name}/history`, { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: !!name,
  });
}

export function useTriggerJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post(`/admin/jobs/${name}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.jobs });
    },
  });
}

// ═══ #5: Provider performance ═════════════════════════════════════════════

export function useProviderPerformance(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.providerPerf(params),
    queryFn: ({ signal }) => api.get('/admin/providers/performance', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// ═══ #6: Patient engagement ═══════════════════════════════════════════════

export function usePatientEngagement(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.patientEngagement(params),
    queryFn: ({ signal }) => api.get('/admin/patients/engagement', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// ═══ #7: Security ═════════════════════════════════════════════════════════

export function useSecuritySummary(window: string) {
  return useQuery({
    queryKey: todoKeys.security(window),
    queryFn: ({ signal }) => api.get('/admin/security/summary', { params: { window }, signal }).then((r) => r.data.data),
    staleTime: 30_000,
  });
}

// ═══ #8: Linking ══════════════════════════════════════════════════════════

export function useLinkingSummary() {
  return useQuery({
    queryKey: todoKeys.linkingSummary,
    queryFn: ({ signal }) => api.get('/admin/linking/summary', { signal }).then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useLinkingCodes(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.linkingCodes(params),
    queryFn: ({ signal }) => api.get('/admin/linking/codes', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useLinkingLinks(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.linkingLinks(params),
    queryFn: ({ signal }) => api.get('/admin/linking/links', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

// ═══ #9: PHI access ══════════════════════════════════════════════════════

export function usePhiByActor(params: Record<string, unknown>, enabled: boolean) {
  return useQuery({
    queryKey: todoKeys.phiByActor(params),
    queryFn: ({ signal }) => api.get('/admin/phi-access/by-actor', { params, signal }).then((r) => r.data.data),
    enabled,
    staleTime: 60_000,
  });
}

export function usePhiByResource(params: Record<string, unknown>, enabled: boolean) {
  return useQuery({
    queryKey: todoKeys.phiByResource(params),
    queryFn: ({ signal }) => api.get('/admin/phi-access/by-resource', { params, signal }).then((r) => r.data.data),
    enabled,
    staleTime: 60_000,
  });
}

export function usePhiAnomalies(window: string) {
  return useQuery({
    queryKey: todoKeys.phiAnomalies(window),
    queryFn: ({ signal }) => api.get('/admin/phi-access/anomalies', { params: { window }, signal }).then((r) => r.data.data),
    staleTime: 60_000,
  });
}

// ═══ #10: Notification preferences ════════════════════════════════════════

export function useNotifPrefsSummary() {
  return useQuery({
    queryKey: todoKeys.notifPrefs,
    queryFn: ({ signal }) => api.get('/admin/notifications/preferences-summary', { signal }).then((r) => r.data.data),
    staleTime: 60_000,
  });
}

// ═══ #11: Search ══════════════════════════════════════════════════════════

export function useAdminSearch(q: string, types?: string) {
  return useQuery({
    queryKey: todoKeys.search(q),
    queryFn: ({ signal }) => api.get('/admin/search', { params: { q, types }, signal }).then((r) => r.data.data),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
}

// ═══ #12: Broadcasts ══════════════════════════════════════════════════════

export function useBroadcasts(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.broadcasts(params),
    queryFn: ({ signal }) => api.get('/admin/broadcasts', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/admin/broadcasts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'broadcasts'] });
    },
  });
}

// ═══ #13: System metrics ══════════════════════════════════════════════════

export function useSystemMetrics() {
  return useQuery({
    queryKey: todoKeys.systemMetrics,
    queryFn: ({ signal }) => api.get('/admin/system/metrics', { signal }).then((r) => r.data.data),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

// ═══ #14: Scheduled reports ═══════════════════════════════════════════════

export function useScheduledReports(params: Record<string, unknown>) {
  return useQuery({
    queryKey: todoKeys.scheduledReports(params),
    queryFn: ({ signal }) => api.get('/admin/scheduled-reports', { params, signal }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/admin/scheduled-reports', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'scheduled-reports'] });
    },
  });
}

export function useUpdateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown>) => api.patch(`/admin/scheduled-reports/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'scheduled-reports'] });
    },
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/scheduled-reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'scheduled-reports'] });
    },
  });
}

// ═══ #15: Feature flags ═══════════════════════════════════════════════════

export function useFeatureFlags() {
  return useQuery({
    queryKey: todoKeys.featureFlags,
    queryFn: ({ signal }) => api.get('/admin/feature-flags', { signal }).then((r) => r.data.data),
    staleTime: 30_000,
  });
}

export function useCreateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/admin/feature-flags', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.featureFlags });
    },
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...data }: Record<string, unknown>) => api.patch(`/admin/feature-flags/${key}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.featureFlags });
    },
  });
}

export function useDeleteFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(`/admin/feature-flags/${key}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: todoKeys.featureFlags });
    },
  });
}
