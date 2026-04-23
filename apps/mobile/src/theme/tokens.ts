/**
 * Design tokens — TMJConnect 4-tier system.
 *
 *   Tier 1–2  Brand:  Navy (dominant, authority) + Gold (accent, CTA pop)
 *   Tier 3    Neutral: colorless surfaces + 3 text weights
 *   Tier 4    Semantic: success / warning / danger for status, never decoration
 *
 * Rule: brand = identity, surface = containers, semantic = status. Never mix.
 * A success badge is always green — even though gold is the accent color.
 */

export const colors = {
  // ─── Tier 1–2: Brand ────────────────────────────────────────────────────
  navy: {
    standard: '#1B3A5C',
    dark: '#14304A',
    deep: '#0F2339',
    ghost: 'rgba(27, 58, 92, 0.08)',
    ghostStrong: 'rgba(27, 58, 92, 0.14)',
  },
  gold: {
    standard: '#D4A843',
    hover: '#E0BA66',
    ghost: 'rgba(212, 168, 67, 0.10)',
    ghostStrong: 'rgba(212, 168, 67, 0.18)',
  },
  // ─── Tier 3: Neutral ────────────────────────────────────────────────────
  ink: {
    primary: '#0F172A',
    secondary: '#4B5563',
    tertiary: '#9CA3AF',
  },
  surface: {
    background: '#FFFFFF',
    muted: '#F6F7F8',
    card: '#FFFFFF',
    border: '#E5E7EB',
  },
  // ─── Tier 4: Semantic ───────────────────────────────────────────────────
  success: { soft: '#D1FAE5', base: '#10B981', strong: '#047857' },
  warning: { soft: '#FEF3C7', base: '#F59E0B', strong: '#B45309' },
  danger: { soft: '#FEE2E2', base: '#EF4444', strong: '#B91C1C' },
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const typography = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const },
} as const;
