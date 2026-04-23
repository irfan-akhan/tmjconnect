import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptLinkingCode, disconnectLink } from '../lib/linking.api';
import { qk } from './usePatient';

export function useAcceptLinkingCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => acceptLinkingCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.links });
    },
  });
}

export function useDisconnectLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => disconnectLink(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.links });
    },
  });
}
