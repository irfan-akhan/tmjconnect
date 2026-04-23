import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type LinkingCodeStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type LinkingCode = {
  id: string;
  code: string;
  provider_id: string;
  patient_id: string | null;
  status: LinkingCodeStatus;
  expires_at: string;
  created_at: string;
};

export type PatientLink = {
  link_id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  linked_at: string;
};

export function useLinkingCodes() {
  return useQuery({
    queryKey: ['linking', 'codes'],
    queryFn: () =>
      apiFetch<{ data: LinkingCode[] }>('/linking/codes').then((r) => r.data),
  });
}

export function useLinks() {
  return useQuery({
    queryKey: ['linking', 'links'],
    queryFn: () =>
      apiFetch<{ data: PatientLink[] }>('/linking/links').then((r) => r.data),
  });
}

export function useGenerateCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ data: LinkingCode }>('/linking/codes', { method: 'POST' }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['linking', 'codes'] }),
  });
}

export function useEmailInvite() {
  return useMutation({
    mutationFn: ({ code, patient_email, patient_name }: { code: string; patient_email: string; patient_name?: string }) =>
      apiFetch<{ message: string }>(`/linking/codes/${code}/invite`, {
        method: 'POST',
        body: { patient_email, patient_name: patient_name || undefined },
      }),
  });
}

export function useDisconnectLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiFetch<null>(`/linking/links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['linking'] });
      qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
