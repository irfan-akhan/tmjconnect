import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deletePatientMe,
  getNotificationPrefs,
  getPatientActivity,
  getPatientSessions,
  revokePatientSession,
  updateNotificationPrefs,
  updatePatientMe,
  type NotificationPrefs,
  type UpdatePatientProfileInput,
} from '../lib/patient.api';
import { qk } from './usePatient';

export const profileKeys = {
  sessions: ['profile', 'sessions'] as const,
  activity: ['profile', 'activity'] as const,
  notifPrefs: ['profile', 'notification-prefs'] as const,
};

export const useSessions = () =>
  useQuery({ queryKey: profileKeys.sessions, queryFn: getPatientSessions });

export const useActivity = () =>
  useQuery({ queryKey: profileKeys.activity, queryFn: getPatientActivity });

export const useNotificationPrefs = () =>
  useQuery({ queryKey: profileKeys.notifPrefs, queryFn: getNotificationPrefs });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePatientProfileInput) => updatePatientMe(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => revokePatientSession(sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.sessions }),
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<NotificationPrefs>) => updateNotificationPrefs(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.notifPrefs }),
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => deletePatientMe() });
}
