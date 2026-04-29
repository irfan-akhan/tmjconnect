import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type DigestFrequency = 'instant' | 'daily' | 'weekly' | 'off';

export type NotificationPreferences = {
  exercise_reminders: boolean;
  symptom_checkin: boolean;
  provider_messages: boolean;
  report_updates: boolean;
  tips_updates: boolean;
  email_digest: DigestFrequency;
};

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () =>
      apiFetch<{ data: NotificationPreferences }>('/notifications/preferences').then(
        (r) => r.data,
      ),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<NotificationPreferences>) =>
      apiFetch<{ data: NotificationPreferences }>('/notifications/preferences', {
        method: 'PATCH',
        body,
      }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['notification-preferences'], data);
      toast.success('Notification preferences updated.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update preferences.'),
  });
}
