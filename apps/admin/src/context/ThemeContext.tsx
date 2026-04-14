import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const STORAGE_KEY = 'admin_theme_mode';

/**
 * Initial theme resolution:
 *   1. localStorage value if it exists
 *   2. system preference (prefers-color-scheme)
 *   3. fall back to light
 *
 * Runs synchronously on first render so the page never flashes the wrong theme.
 */
function resolveInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(resolveInitialMode);

  // Sync the mode to <html class="dark"> so Tailwind dark: variants work,
  // and persist to localStorage so the choice survives reloads.
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const value = useMemo<ThemeState>(
    () => ({
      mode,
      setMode: setModeState,
      toggle: () => setModeState((m) => (m === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
