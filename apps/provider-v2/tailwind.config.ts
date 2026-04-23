import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.035em',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        navy: {
          50: '#EBF0F5',
          100: '#CBD9E8',
          200: '#9CB3D0',
          300: '#6888B0',
          400: '#3D5F8F',
          500: '#2A4670',
          600: '#1B3A5C',
          700: '#162844',
          800: '#0F1D33',
          900: '#0A1628',
        },
        gold: {
          50: '#FDFCF8',
          100: '#FAF7F0',
          200: '#F4EEDD',
          300: '#ECDDB5',
          400: '#E4CC91',
          500: '#DCBA6A',
          600: '#D4A843',
          700: '#AA7A2B',
          800: '#8B6220',
          900: '#6B4A15',
        },
        ok: {
          DEFAULT: '#1B8A5A',
          dark: '#0F5A3B',
          light: '#E6F5EE',
        },
        warn: {
          DEFAULT: '#C67E1A',
          dark: '#9A6114',
          light: '#FDF3E4',
        },
        err: {
          DEFAULT: '#BD3A3A',
          dark: '#862626',
          light: '#F9E6E6',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        'navy-xs': '0 1px 2px rgba(10, 22, 40, 0.04)',
        'navy-sm': '0 2px 8px rgba(10, 22, 40, 0.06), 0 1px 2px rgba(10, 22, 40, 0.04)',
        'navy-md': '0 8px 24px rgba(10, 22, 40, 0.08), 0 2px 6px rgba(10, 22, 40, 0.04)',
        'navy-lg': '0 20px 48px rgba(10, 22, 40, 0.12), 0 4px 12px rgba(10, 22, 40, 0.06)',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
