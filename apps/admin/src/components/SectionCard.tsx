import { type ReactNode } from 'react';

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot inside the card header (e.g. filter chip, "view all" link). */
  extra?: ReactNode;
  /** Removes the inner padding — useful when the body is a Table. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * SectionCard — softly elevated panel for grouping related content. Used as
 * the wrapper for charts, lists, tables, and forms across all pages. Replaces
 * the default antd Card so we can keep the visual language consistent.
 */
export default function SectionCard({
  title,
  subtitle,
  extra,
  flush = false,
  className = '',
  children,
}: SectionCardProps) {
  const hasHeader = title || subtitle || extra;

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-card dark:border-white/[0.07] dark:bg-[#0F172A] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)] ${className}`}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]">
          <div className="min-w-0">
            {title && (
              <h3 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {extra && <div className="shrink-0">{extra}</div>}
        </div>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
    </div>
  );
}
