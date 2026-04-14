import { readJson, writeJson } from './storage';

/**
 * filterPresets.ts — localStorage-backed saved views.
 *
 * Each scope (e.g. 'audit-logs') gets its own list of named filter presets.
 * The shape of the filter object is opaque to this module — it's stored as
 * JSON and handed back to the caller verbatim. The page that owns the scope
 * is responsible for serialising/deserialising the actual filter state.
 */
export interface FilterPreset<T = Record<string, unknown>> {
  id: string;
  name: string;
  filters: T;
  createdAt: string;
}

const KEY = (scope: string) => `admin_filter_presets_v1:${scope}`;

export function listPresets<T = Record<string, unknown>>(scope: string): FilterPreset<T>[] {
  return readJson<FilterPreset<T>[]>(KEY(scope), []);
}

export function savePreset<T = Record<string, unknown>>(
  scope: string,
  name: string,
  filters: T,
): FilterPreset<T> {
  const preset: FilterPreset<T> = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    filters,
    createdAt: new Date().toISOString(),
  };
  const next = [preset, ...listPresets<T>(scope)];
  writeJson(KEY(scope), next);
  return preset;
}

export function deletePreset(scope: string, id: string): void {
  const next = listPresets(scope).filter((p) => p.id !== id);
  writeJson(KEY(scope), next);
}

/** Rename an existing preset in place. Returns the updated list. */
export function renamePreset<T = Record<string, unknown>>(
  scope: string,
  id: string,
  newName: string,
): FilterPreset<T>[] {
  const list = listPresets<T>(scope);
  const next = list.map((p) => (p.id === id ? { ...p, name: newName } : p));
  writeJson(KEY(scope), next);
  return next;
}
