import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const filterPillVariants = cva(
  'inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
        active: 'border-transparent bg-gold-600 text-navy-900 hover:bg-gold-500',
        urgent: 'border-transparent bg-err/10 text-err-dark hover:bg-err/15',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface FilterPillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof filterPillVariants> {
  count?: number;
  active?: boolean;
  urgent?: boolean;
  icon?: React.ReactNode;
}

export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ className, variant, count, active, urgent, icon, children, ...props }, ref) => {
    const resolved = variant ?? (active ? 'active' : urgent ? 'urgent' : 'default');
    return (
      <button
        ref={ref}
        type="button"
        className={cn(filterPillVariants({ variant: resolved }), className)}
        aria-pressed={active}
        {...props}
      >
        {(icon ?? (urgent && !active ? <TriangleAlert className="h-3 w-3" /> : null)) || null}
        <span>{children}</span>
        {typeof count === 'number' && (
          <span
            className={cn(
              'ml-1 rounded-sm px-1 py-0.5 text-[10px] tracking-wider',
              active
                ? 'bg-navy-900/30 text-navy-900'
                : urgent
                  ? 'bg-err/15 text-err-dark'
                  : 'bg-secondary text-muted-foreground',
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);
FilterPill.displayName = 'FilterPill';
