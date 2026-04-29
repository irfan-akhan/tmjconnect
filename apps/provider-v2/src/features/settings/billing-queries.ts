import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type BillingPlan = {
  tier: 'pilot' | 'starter' | 'growth' | 'enterprise';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  monthly_price_cents: number;
  started_at: string;
  current_period_end: string | null;
};

export type BillingInvoice = {
  id: string;
  issued_at: string;
  amount_cents: number;
  status: 'paid' | 'open' | 'void';
  pdf_url: string | null;
};

export type BillingResponse = {
  plan: BillingPlan;
  payment_method: null | {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  invoices: BillingInvoice[];
};

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () =>
      apiFetch<{ data: BillingResponse }>('/providers/me/billing').then((r) => r.data),
  });
}
