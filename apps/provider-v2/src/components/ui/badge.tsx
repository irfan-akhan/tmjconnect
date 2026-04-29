import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        navy: 'border-transparent bg-navy-600 text-background',
        gold: 'border-transparent bg-gold-600 text-navy-900',
        urgent: 'border-transparent bg-err/10 text-err-dark',
        moderate: 'border-transparent bg-warn/10 text-warn-dark',
        improving: 'border-transparent bg-ok/10 text-ok-dark',
        stable: 'border-transparent bg-ok/10 text-ok-dark',
        inactive: 'border-transparent bg-muted text-muted-foreground',
        new: 'border-transparent bg-warn/10 text-warn-dark',
        unanswered: 'border-transparent bg-err/10 text-err-dark',
        responded: 'border-transparent bg-ok/10 text-ok-dark',
        fyi: 'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        sm: 'h-5 px-1.5',
        md: 'h-6 px-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'sm' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { badgeVariants };
