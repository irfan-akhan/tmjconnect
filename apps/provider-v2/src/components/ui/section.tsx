import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Section — the editorial-clinical "card" used across most pages: hairline
 * border, navy-xs shadow, rounded-sm, with an optional title / subtitle /
 * action header. Replaces the inline `Card` helpers that were duplicated in
 * SettingsPage and AnalyticsPage so we have one source of truth for the
 * surface treatment.
 */
export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  bodyClassName?: string;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, title, subtitle, action, bodyClassName, children, ...props }, ref) => {
    const hasHeader = title || subtitle || action;
    return (
      <section
        ref={ref}
        className={cn(
          'rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs',
          className,
        )}
        {...props}
      >
        {hasHeader && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              {title && (
                <h3 className="font-serif text-lg tracking-tightest text-foreground">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {action}
          </div>
        )}
        <div className={cn(bodyClassName)}>{children}</div>
      </section>
    );
  },
);
Section.displayName = 'Section';
