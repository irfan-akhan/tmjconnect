import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications.api';

const KEY = ['notifications', 'inbox'] as const;

export function useNotificationsInbox(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: [...KEY, pageSize] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listNotifications({ limit: pageSize, cursor: pageParam }),
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor ?? undefined : undefined),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
