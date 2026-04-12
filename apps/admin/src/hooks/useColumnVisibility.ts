import { useState, useMemo, useCallback } from 'react';
import { readJson, writeJson } from '../utils/storage';

/**
 * useColumnVisibility — manages which table columns are visible.
 *
 * Persists the admin's selection per-page in localStorage so reopening
 * the page after a reload shows the same columns they had visible.
 *
 * Usage:
 *   const { visibleKeys, isVisible, toggle, reset } = useColumnVisibility(
 *     'users-page',
 *     allColumns.map(c => c.key as string),
 *   );
 *   const filteredColumns = allColumns.filter(c => isVisible(c.key as string));
 */
export function useColumnVisibility(scope: string, allKeys: string[]) {
  const storageKey = `admin_col_vis_v1:${scope}`;

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    const stored = readJson<string[]>(storageKey, []);
    return new Set(stored);
  });

  const persist = useCallback(
    (next: Set<string>) => {
      writeJson(storageKey, [...next]);
    },
    [storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      setHiddenKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    setHiddenKeys(new Set());
    persist(new Set());
  }, [persist]);

  const isVisible = useCallback((key: string) => !hiddenKeys.has(key), [hiddenKeys]);

  const visibleKeys = useMemo(
    () => allKeys.filter((k) => !hiddenKeys.has(k)),
    [allKeys, hiddenKeys],
  );

  return { visibleKeys, hiddenKeys, isVisible, toggle, reset };
}
