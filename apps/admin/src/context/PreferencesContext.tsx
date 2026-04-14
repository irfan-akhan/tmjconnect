import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { readJson, writeJson } from '../utils/storage';
import { resolveTimezone } from '../utils/time';

/** UI density — affects table/list spacing across the app. */
export type Density = 'compact' | 'comfortable';

/** Time format admins prefer to see. */
export type TimeFormat = '12h' | '24h';

/** Recently viewed entity recorded after navigating to a detail page. */
export interface RecentEntity {
  type: 'user' | 'report';
  id: string;
  label: string;
  subtitle?: string;
  visitedAt: string;
}

interface PreferencesState {
  density: Density;
  setDensity: (d: Density) => void;

  timeFormat: TimeFormat;
  setTimeFormat: (f: TimeFormat) => void;

  /** IANA timezone string. 'system' = use the browser's tz. */
  timezone: string;
  setTimezone: (tz: string) => void;
  /** The IANA tz to actually format with — `system` resolved to a real name. */
  resolvedTimezone: string;

  /** Default landing route after login (e.g. '/users'). */
  defaultLanding: string;
  setDefaultLanding: (path: string) => void;

  /** When true, mutate buttons across the app are disabled. */
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;

  /** Sidebar collapsed state — persisted across reloads. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  /** Last 8 entities the admin viewed. Most-recent first. */
  recentlyViewed: RecentEntity[];
  recordVisit: (entity: Omit<RecentEntity, 'visitedAt'>) => void;
  clearRecentlyViewed: () => void;
}

const PreferencesContext = createContext<PreferencesState | null>(null);

const STORAGE_KEY = 'admin_preferences_v1';
const RECENT_KEY = 'admin_recently_viewed_v1';
const MAX_RECENT = 8;

interface StoredPrefs {
  density: Density;
  timeFormat: TimeFormat;
  timezone: string;
  defaultLanding: string;
  readOnly: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_PREFS: StoredPrefs = {
  density: 'comfortable',
  timeFormat: '12h',
  timezone: 'system',
  defaultLanding: '/',
  readOnly: false,
  sidebarCollapsed: false,
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<StoredPrefs>(() => ({
    ...DEFAULT_PREFS,
    ...readJson<Partial<StoredPrefs>>(STORAGE_KEY, {}),
  }));

  const [recentlyViewed, setRecentlyViewed] = useState<RecentEntity[]>(() =>
    readJson<RecentEntity[]>(RECENT_KEY, []),
  );

  // Persist preferences whenever they change.
  useEffect(() => {
    writeJson(STORAGE_KEY, prefs);
  }, [prefs]);

  useEffect(() => {
    writeJson(RECENT_KEY, recentlyViewed);
  }, [recentlyViewed]);

  const update = useCallback(<K extends keyof StoredPrefs>(key: K, value: StoredPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const recordVisit = useCallback((entity: Omit<RecentEntity, 'visitedAt'>) => {
    setRecentlyViewed((prev) => {
      const without = prev.filter((e) => !(e.type === entity.type && e.id === entity.id));
      const next: RecentEntity[] = [
        { ...entity, visitedAt: new Date().toISOString() },
        ...without,
      ];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const clearRecentlyViewed = useCallback(() => setRecentlyViewed([]), []);

  const resolvedTimezone = useMemo(() => resolveTimezone(prefs.timezone), [prefs.timezone]);

  const value = useMemo<PreferencesState>(
    () => ({
      density: prefs.density,
      setDensity: (d) => update('density', d),
      timeFormat: prefs.timeFormat,
      setTimeFormat: (f) => update('timeFormat', f),
      timezone: prefs.timezone,
      setTimezone: (tz) => update('timezone', tz),
      resolvedTimezone,
      defaultLanding: prefs.defaultLanding,
      setDefaultLanding: (path) => update('defaultLanding', path),
      readOnly: prefs.readOnly,
      setReadOnly: (v) => update('readOnly', v),
      sidebarCollapsed: prefs.sidebarCollapsed,
      setSidebarCollapsed: (v) => update('sidebarCollapsed', v),
      recentlyViewed,
      recordVisit,
      clearRecentlyViewed,
    }),
    [prefs, resolvedTimezone, recentlyViewed, recordVisit, clearRecentlyViewed, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
