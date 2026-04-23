import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type ProviderProfile = {
  id: string;
  email: string;
  phone: string | null;
  role: 'provider';
  is_active: boolean;
  created_at: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  license_number: string | null;
  license_type: string | null;
  specialty: string | null;
  clinic_name: string | null;
  credentials: string[] | null;
};

export type ProfileUpdate = Partial<{
  first_name: string;
  last_name: string;
  city: string | null;
  state: string | null;
  timezone: string;
  avatar_url: string | null;
  license_number: string;
  license_type: string;
  specialty: string;
  clinic_name: string;
  credentials: string[] | null;
}>;

export async function uploadAvatar(file: File): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append('file', file);
  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
  const res = await fetch(`${BASE_URL}/uploads/avatar`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Upload failed (${res.status})`);
  }
  const payload = await res.json();
  return payload.data;
}

export type Session = {
  id: string;
  device_info: Record<string, unknown> | string | null;
  ip_address: string | null;
  last_active: string;
  created_at: string;
};

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      apiFetch<{ data: ProviderProfile }>('/providers/me').then((r) => r.data),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) =>
      apiFetch<{ data: ProviderProfile }>('/providers/me', {
        method: 'PATCH',
        body,
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Profile save failed.'),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () =>
      apiFetch<{ data: Session[] }>('/providers/me/sessions').then((r) => r.data),
  });
}

export type ActivityEntry = {
  id: string;
  action: string;
  resource_type: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export function useActivity(limit = 20) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () =>
      apiFetch<{ data: ActivityEntry[] }>('/providers/me/activity', {
        query: { limit },
      }).then((r) => r.data),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/providers/me/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked.');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to revoke session.'),
  });
}
