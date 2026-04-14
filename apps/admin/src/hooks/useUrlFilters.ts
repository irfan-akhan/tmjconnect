import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

interface UrlFiltersApi<T> {
  filters: T;
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setMany: (next: Partial<T>) => void;
  reset: () => void;
  /**
   * Push the current filter set as a NEW history entry. Used by the
   * "Apply" button so the browser back button steps between filter
   * snapshots instead of skipping past them. Per-keystroke `setFilter`
   * still uses replace so we don't pollute history while typing.
   */
  commit: () => void;
}

/**
 * useUrlFilters — small helper that mirrors a flat object of filter values
 * to the URL's `?key=value` query string. Refreshing the page or sharing the
 * link preserves the active filter context.
 *
 * Empty / undefined / null values are stripped so the URL stays clean.
 *
 * Per-keystroke updates use `replace: true` so we don't fill the history
 * stack. Call `commit()` (typically from an Apply button) to push a new
 * history entry that the back button can step through.
 */
export function useUrlFilters<T extends Record<string, string | undefined>>(
  defaults: T,
): UrlFiltersApi<T> {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const out = { ...defaults } as T;
    for (const key of Object.keys(defaults)) {
      const v = params.get(key);
      if (v !== null) (out as Record<string, string>)[key] = v;
    }
    return out;
  }, [params, defaults]);

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      const next = new URLSearchParams(params);
      if (value === undefined || value === null || value === '') {
        next.delete(key as string);
      } else {
        next.set(key as string, String(value));
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setMany = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '') {
          next.delete(k);
        } else {
          next.set(k, String(v));
        }
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  const commit = useCallback(() => {
    // Re-write the same params but with `replace: false` so a new history
    // entry is pushed. Useful so back/forward navigates between snapshots.
    setParams(new URLSearchParams(params), { replace: false });
  }, [params, setParams]);

  return { filters, setFilter, setMany, reset, commit };
}
