import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const kpiVariants = cva(
  'relative flex flex-col gap-3 rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs transition-shadow hover:shadow-navy-sm',
  {
    variants: {
      accent: {
        none: '',
        gold: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gold-600',
        urgent: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-err',
        ok: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-ok',
        navy: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-navy-600',
      },
    },
    defaultVariants: { accent: 'none' },
  },
);

export interface KpiCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof kpiVariants> {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ReactNode;
  hint?: React.ReactNode;
}

export const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  ({ className, accent, label, value, delta, trend, icon, hint, ...props }, ref) => {
    const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
    return (
      <div ref={ref} className={cn(kpiVariants({ accent }), className)} {...props}>
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className="font-serif text-4xl leading-none tracking-tightest text-foreground">
          {value}
        </div>
        {(delta || hint) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {delta && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  trend === 'up' && 'text-ok-dark',
                  trend === 'down' && 'text-err-dark',
                )}
              >
                <TrendIcon className="h-3 w-3" />
                {delta}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
      </div>
    );
  },
);
KpiCard.displayName = 'KpiCard';
