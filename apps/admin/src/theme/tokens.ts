/**
 * Design tokens — single source of truth for colours, spacing, typography, and
 * elevation. Imported by:
 *   - tailwind.config.ts → exposes the palette as Tailwind classes
 *   - App.tsx → feeds Ant Design's ConfigProvider so antd components match
 *
 * Visual identity: calm healthcare premium. Teal-forward primary that reads
 * trustworthy and clinical without veering into the generic SaaS-blue space.
 */
export const colors = {
  // ─── Brand ─────────────────────────────────────────────────────────────────
  brand: {
    50:  '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6', // accent / hover
    600: '#0D9488', // primary
    700: '#0F766E', // primary-hover
    800: '#115E59',
    900: '#134E4A',
  },
  // ─── Neutral (slate) — surfaces, borders, body text ───────────────────────
  slate: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A', // sidebar background
    950: '#020617',
  },
  // ─── Semantic ──────────────────────────────────────────────────────────────
  success: { soft: '#ECFDF5', base: '#10B981', strong: '#047857' },
  warning: { soft: '#FFFBEB', base: '#F59E0B', strong: '#B45309' },
  danger:  { soft: '#FEF2F2', base: '#EF4444', strong: '#B91C1C' },
  // Clinical "urgent" — distinct from generic danger so urgent reports pop.
  urgent:  { soft: '#FFF1F2', base: '#E11D48', strong: '#9F1239' },
  info:    { soft: '#EFF6FF', base: '#3B82F6', strong: '#1D4ED8' },
} as const;

/** Per-role tag colours used across user/report tables. */
export const roleColors = {
  admin:    { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
  provider: { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  patient:  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
} as const;

/** Urgency colours for the reports monitor. */
export const urgencyColors = {
  routine:    { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  concerning: { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  urgent:     { bg: '#FFF1F2', text: '#9F1239', border: '#FECDD3' },
} as const;

/** Border radii — slightly larger than default antd for a softer premium feel. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
} as const;

/** Shadow scale tuned for white-on-slate-50 surfaces. */
export const shadows = {
  card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
  cardHover: '0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)',
  popover: '0 10px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.05)',
} as const;
