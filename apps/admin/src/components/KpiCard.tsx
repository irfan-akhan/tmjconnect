import { type ReactNode } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { useThemeMode } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import Sparkline from './Sparkline';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  /** Icon shown in the upper-right corner badge. */
  icon: ReactNode;
  /** Tone of the icon badge — controls background tint. */
  tone?: 'brand' | 'info' | 'success' | 'warning' | 'danger';
  /** Optional change indicator. Positive = up, negative = down, 0 = flat. */
  delta?: number;
  /** Period label for the delta (e.g. "vs. last week"). */
  deltaLabel?: string;
  /** Subtle helper line under the value. */
  hint?: string;
  /** Tiny trend line shown beneath the delta row. ~14 points usually. */
  sparkline?: number[];
  loading?: boolean;
}

// Light + dark soft tints. The dark tints are deliberately desaturated so the
// icon stays the focal point on slate-800 surfaces.
const tones: Record<
  NonNullable<KpiCardProps['tone']>,
  { bg: string; fg: string; bgDark: string; fgDark: string; line: string }
> = {
  brand:   { bg: '#F0FDFA', fg: '#0F766E', bgDark: 'rgba(20, 184, 166, 0.14)', fgDark: '#5EEAD4', line: '#0D9488' },
  info:    { bg: '#EFF6FF', fg: '#1D4ED8', bgDark: 'rgba(59, 130, 246, 0.14)', fgDark: '#93C5FD', line: '#3B82F6' },
  success: { bg: '#ECFDF5', fg: '#047857', bgDark: 'rgba(16, 185, 129, 0.14)', fgDark: '#6EE7B7', line: '#10B981' },
  warning: { bg: '#FFFBEB', fg: '#B45309', bgDark: 'rgba(245, 158, 11, 0.14)', fgDark: '#FCD34D', line: '#F59E0B' },
  danger:  { bg: '#FEF2F2', fg: '#B91C1C', bgDark: 'rgba(239, 68, 68, 0.14)', fgDark: '#FCA5A5', line: '#EF4444' },
};

/**
 * KpiCard — premium dashboard tile.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │ LABEL              [icon]   │
 *   │ 1,247                       │
 *   │ ↑ 12% vs. last week         │
 *   │ ╱╲╱──╲╱╱  (sparkline)       │
 *   └─────────────────────────────┘
 */
export default function KpiCard({
  label,
  value,
  icon,
  tone = 'brand',
  delta,
  deltaLabel,
  hint,
  sparkline,
  loading = false,
}: KpiCardProps) {
  const { mode } = useThemeMode();
  const { density } = usePreferences();
  const t = tones[tone];
  const isDark = mode === 'dark';
  const compact = density === 'compact';

  const trendClass =
    delta === undefined ? '' : delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : 'trend-flat';
  const trendIcon =
    delta === undefined ? null : delta > 0 ? <ArrowUpOutlined /> : delta < 0 ? <ArrowDownOutlined /> : <MinusOutlined />;

  return (
    <div
      className={`card-hover rounded-lg border border-slate-200 bg-white shadow-card dark:border-white/[0.07] dark:bg-[#0F172A] ${
        compact ? 'p-3' : 'p-5'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div
          className={`flex items-center justify-center rounded-md ${
            compact ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg'
          }`}
          style={{
            background: isDark ? t.bgDark : t.bg,
            color: isDark ? t.fgDark : t.fg,
          }}
        >
          {icon}
        </div>
      </div>

      <div
        className={`mt-3 font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-100 ${
          compact ? 'text-[22px]' : 'text-[28px]'
        }`}
      >
        {loading ? (
          <span className="inline-block h-7 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        ) : (
          value
        )}
      </div>

      {(delta !== undefined || hint) && (
        <div className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
          {delta !== undefined && (
            <span
              className={`${trendClass} inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold`}
            >
              {trendIcon}
              {Math.abs(delta)}%
            </span>
          )}
          {(deltaLabel || hint) && (
            <span className="text-xs text-slate-500 dark:text-slate-400">{deltaLabel ?? hint}</span>
          )}
        </div>
      )}

      {sparkline && sparkline.length > 1 && !loading && (
        <Sparkline
          data={sparkline}
          color={isDark ? t.fgDark : t.line}
          height={compact ? 24 : 32}
          showTooltip
        />
      )}
    </div>
  );
}
