import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export type SupportTicketCategory =
  | 'technical'
  | 'billing'
  | 'clinical'
  | 'feature'
  | 'other';

export type SupportTicket = {
  id: string;
  user_id: string;
  category: SupportTicketCategory;
  subject: string;
  body: string;
  attach_diagnostic: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
};

export type CreateTicketInput = {
  category: SupportTicketCategory;
  subject: string;
  body: string;
  attach_diagnostic?: boolean;
};

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTicketInput) =>
      apiFetch<{ data: SupportTicket }>('/support/tickets', {
        method: 'POST',
        body,
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Support ticket submitted. We\'ll reply within 4 business hours.');
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to submit ticket.'),
  });
}

export function useSupportTickets(limit = 20) {
  return useQuery({
    queryKey: ['support-tickets', limit],
    queryFn: () =>
      apiFetch<{ data: SupportTicket[] }>('/support/tickets', { query: { limit } }).then(
        (r) => r.data,
      ),
  });
}
