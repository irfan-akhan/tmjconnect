import { api } from './api';
import type { NotificationItem } from './patient.api';

type Meta = { limit: number; nextCursor: string | null; hasMore: boolean };

export async function listNotifications(params: { limit?: number; cursor?: string } = {}) {
  const res = await api.get<{ data: NotificationItem[]; meta: Meta }>('/notifications', {
    query: { limit: params.limit ?? 20, cursor: params.cursor },
  });
  return res;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await api.patch<{ data: NotificationItem }>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
