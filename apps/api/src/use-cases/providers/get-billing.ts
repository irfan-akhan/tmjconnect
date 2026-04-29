/**
 * get-billing.ts — Returns the provider's current billing/plan view.
 *
 * MVP: every provider account is on the free pilot tier. We synthesise the
 * response from the provider's account row instead of carrying a separate
 * subscriptions table — when Stripe (or similar) lands, swap the body of this
 * use-case without touching the route or the UI.
 */
import { eq } from 'drizzle-orm';
import type { Container } from '../../config/container';
import { AppError } from '../../middleware/errorHandler';
import { users } from '../../db/schema';

type Deps = Pick<Container, 'db'>;

export type ProviderBilling = {
  plan: {
    tier: 'pilot' | 'starter' | 'growth' | 'enterprise';
    status: 'active' | 'trialing' | 'past_due' | 'canceled';
    monthly_price_cents: number;
    started_at: string;
    current_period_end: string | null;
  };
  payment_method: null | {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  invoices: Array<{
    id: string;
    issued_at: string;
    amount_cents: number;
    status: 'paid' | 'open' | 'void';
    pdf_url: string | null;
  }>;
};

export async function execute(deps: Deps, input: { userId: string }): Promise<ProviderBilling> {
  const [u] = await deps.db
    .select({ created_at: users.created_at })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Account not found.');

  return {
    plan: {
      tier: 'pilot',
      status: 'active',
      monthly_price_cents: 0,
      started_at: new Date(u.created_at).toISOString(),
      current_period_end: null,
    },
    payment_method: null,
    invoices: [],
  };
}
