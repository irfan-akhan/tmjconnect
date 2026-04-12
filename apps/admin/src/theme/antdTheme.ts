import type { ThemeConfig } from 'antd';
import { theme as antdAlgorithm } from 'antd';
import { colors, radius } from './tokens';

/**
 * Ant Design theme configuration.
 *
 * Dark mode surface hierarchy (each step lighter = more elevated):
 *   Level 0 — Page bg:       #030712  (near-black, rich blue undertone)
 *   Level 1 — Card / panel:  #0F172A  (slate-900, the main working surface)
 *   Level 2 — Header / bar:  #0F172A  (same as card, border separates)
 *   Level 3 — Elevated:      #1E293B  (slate-800, popovers, drawers, hovers)
 *   Level 4 — Inputs:        #1E293B  (same as elevated)
 *   Borders:                  rgba(255 255 255 / 0.07)  (semi-transparent, adapts)
 */

const commonTokens: ThemeConfig['token'] = {
  colorPrimary: colors.brand[600],
  colorPrimaryHover: colors.brand[500],
  colorPrimaryActive: colors.brand[700],
  colorLink: colors.brand[500],
  colorLinkHover: colors.brand[400],

  colorSuccess: colors.success.base,
  colorWarning: colors.warning.base,
  colorError: colors.danger.base,
  colorInfo: colors.info.base,

  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 14,
  fontSizeHeading1: 28,
  fontSizeHeading2: 22,
  fontSizeHeading3: 18,
  fontSizeHeading4: 16,
  fontSizeHeading5: 14,
  lineHeight: 1.55,

  borderRadius: radius.md,
  borderRadiusSM: radius.sm,
  borderRadiusLG: radius.lg,
  borderRadiusXS: 4,

  motionDurationFast: '0.12s',
  motionDurationMid: '0.18s',
  motionDurationSlow: '0.24s',

  controlHeight: 36,
};

const componentBase: ThemeConfig['components'] = {
  Layout: {
    headerHeight: 64,
    headerPadding: '0 24px',
    siderBg: colors.slate[900],
    triggerBg: colors.slate[800],
  },
  Menu: {
    darkItemBg: colors.slate[900],
    darkSubMenuItemBg: colors.slate[900],
    darkItemColor: colors.slate[400],
    darkItemHoverBg: colors.slate[800],
    darkItemHoverColor: colors.slate[100],
    darkItemSelectedBg: 'rgba(20, 184, 166, 0.15)',
    darkItemSelectedColor: colors.brand[300],
    darkPopupBg: colors.slate[900],
    itemBorderRadius: 8,
    itemMarginInline: 8,
    itemMarginBlock: 2,
    itemHeight: 40,
    iconSize: 18,
  },
  Button: {
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 30,
    fontWeight: 500,
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
  },
  Card: {
    headerFontSize: 16,
    headerFontSizeSM: 14,
    paddingLG: 24,
  },
  Table: {
    headerSplitColor: 'transparent',
    cellPaddingBlock: 14,
    cellPaddingInline: 16,
    headerBorderRadius: radius.md,
  },
  Tag: { borderRadiusSM: 6 },
  Input: {
    controlHeight: 38,
    activeBorderColor: colors.brand[600],
    hoverBorderColor: colors.brand[500],
  },
  Select: { controlHeight: 38 },
  DatePicker: { controlHeight: 38 },
  Statistic: { titleFontSize: 13, contentFontSize: 28 },
  Modal: { borderRadiusLG: radius.lg },
  Tabs: {
    itemSelectedColor: colors.brand[400],
    inkBarColor: colors.brand[400],
    itemHoverColor: colors.brand[300],
  },
};

/* ─── Light ──────────────────────────────────────────────────────────────── */
export const lightTheme: ThemeConfig = {
  algorithm: antdAlgorithm.defaultAlgorithm,
  token: {
    ...commonTokens,
    colorBgBase: '#ffffff',
    colorBgLayout: colors.slate[50],
    colorBgContainer: '#ffffff',
    colorBorder: colors.slate[200],
    colorBorderSecondary: colors.slate[100],
    colorSplit: colors.slate[100],
    colorText: colors.slate[800],
    colorTextSecondary: colors.slate[500],
    colorTextTertiary: colors.slate[400],
    colorTextQuaternary: colors.slate[300],
  },
  components: {
    ...componentBase,
    Layout: { ...componentBase.Layout, headerBg: '#ffffff', bodyBg: colors.slate[50] },
    Card: {
      ...componentBase.Card,
      boxShadowTertiary:
        '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
      headerBg: '#ffffff',
    },
    Table: {
      ...componentBase.Table,
      headerBg: colors.slate[50],
      headerColor: colors.slate[600],
      rowHoverBg: colors.slate[50],
      borderColor: colors.slate[100],
    },
    Tag: {
      ...componentBase.Tag,
      defaultBg: colors.slate[100],
      defaultColor: colors.slate[700],
    },
  },
};

/* ─── Dark ───────────────────────────────────────────────────────────────── */
export const darkTheme: ThemeConfig = {
  algorithm: antdAlgorithm.darkAlgorithm,
  token: {
    ...commonTokens,
    // Surface hierarchy — each level slightly lighter for perceived elevation.
    colorBgBase: '#030712',            // level 0 — deepest
    colorBgLayout: '#030712',          // page background
    colorBgContainer: '#0F172A',       // level 1 — cards, panels
    colorBgElevated: '#1E293B',        // level 3 — popovers, drawers, modals
    // Borders use semi-transparent white so they adapt to whatever surface
    // they sit on instead of clashing with a hard hex value.
    colorBorder: 'rgba(255, 255, 255, 0.08)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.05)',
    colorSplit: 'rgba(255, 255, 255, 0.06)',
    // Text
    colorText: '#E2E8F0',              // slate-200 — higher contrast than slate-100
    colorTextSecondary: '#94A3B8',     // slate-400
    colorTextTertiary: '#64748B',      // slate-500
    colorTextQuaternary: '#475569',    // slate-600
    // Fill — used by antd for subtle backgrounds inside inputs, badges, etc.
    colorFillTertiary: 'rgba(255, 255, 255, 0.04)',
    colorFillSecondary: 'rgba(255, 255, 255, 0.06)',
    colorFillQuaternary: 'rgba(255, 255, 255, 0.02)',
  },
  components: {
    ...componentBase,
    Layout: {
      ...componentBase.Layout,
      headerBg: '#0F172A',
      bodyBg: '#030712',
    },
    Card: {
      ...componentBase.Card,
      // Subtle teal-tinted glow instead of black shadow — gives depth without muddy darkness.
      boxShadowTertiary:
        '0 0 0 1px rgba(255, 255, 255, 0.05), 0 2px 8px -2px rgba(0, 0, 0, 0.4)',
      headerBg: '#0F172A',
    },
    Table: {
      ...componentBase.Table,
      headerBg: 'rgba(255, 255, 255, 0.03)',
      headerColor: '#94A3B8',
      rowHoverBg: 'rgba(255, 255, 255, 0.04)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
    },
    Tag: {
      ...componentBase.Tag,
      defaultBg: 'rgba(255, 255, 255, 0.06)',
      defaultColor: '#CBD5E1',
    },
    Input: {
      ...componentBase.Input,
      colorBgContainer: '#1E293B',
      activeBorderColor: colors.brand[500],
      hoverBorderColor: colors.brand[600],
    },
    Select: {
      ...componentBase.Select,
      colorBgContainer: '#1E293B',
    },
    DatePicker: {
      ...componentBase.DatePicker,
      colorBgContainer: '#1E293B',
    },
    Modal: {
      ...componentBase.Modal,
      contentBg: '#0F172A',
      headerBg: '#0F172A',
    },
    Drawer: {
      colorBgElevated: '#0F172A',
    },
    Dropdown: {
      colorBgElevated: '#1E293B',
    },
    Popover: {
      colorBgElevated: '#1E293B',
    },
    Tabs: {
      ...componentBase.Tabs,
      itemSelectedColor: colors.brand[300],
      inkBarColor: colors.brand[400],
      itemHoverColor: colors.brand[300],
    },
  },
};

export const antdTheme = lightTheme;
