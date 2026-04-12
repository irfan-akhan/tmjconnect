import type { Config } from 'tailwindcss';
import { colors, radius, shadows } from './src/theme/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Class-based dark mode — toggled via the `dark` class on <html>.
  // ThemeProvider keeps that class in sync with the user's chosen mode.
  darkMode: 'class',
  corePlugins: {
    preflight: false, // Prevent Tailwind from resetting Ant Design styles.
  },
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        slate: colors.slate,
        success: colors.success.base,
        warning: colors.warning.base,
        danger: colors.danger.base,
        urgent: colors.urgent.base,
        info: colors.info.base,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
      },
      boxShadow: {
        card: shadows.card,
        cardHover: shadows.cardHover,
        popover: shadows.popover,
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
