import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App as AntdApp } from 'antd';
import { readJson, writeJson } from '../utils/storage';

export type ToastLevel = 'success' | 'info' | 'warning' | 'error';

export interface ToastEntry {
  id: string;
  level: ToastLevel;
  text: string;
  /** ISO timestamp when the toast was emitted. */
  at: string;
}

interface ToastHistoryState {
  /** Most-recent first. Capped at 30. */
  history: ToastEntry[];
  unreadCount: number;
  push: (level: ToastLevel, text: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const ToastHistoryContext = createContext<ToastHistoryState | null>(null);

const STORAGE_KEY = 'admin_toast_history_v1';
const MAX_HISTORY = 30;

interface Stored {
  history: ToastEntry[];
  lastReadAt: string;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * ToastHistoryProvider — wraps `antd`'s message API so every toast we emit
 * also lands in a persistent history. Components consume `usePushToast()`
 * to fire toasts and the topbar drawer reads `usePushToast().history`.
 *
 * Antd's `App.useApp()` must be available, so this provider must live INSIDE
 * the `<AntdApp>` boundary.
 */
export function ToastHistoryProvider({ children }: { children: ReactNode }) {
  const { message } = AntdApp.useApp();

  const initial = readJson<Stored>(STORAGE_KEY, {
    history: [],
    lastReadAt: new Date(0).toISOString(),
  });

  const [history, setHistory] = useState<ToastEntry[]>(initial.history);
  const [lastReadAt, setLastReadAt] = useState<string>(initial.lastReadAt);

  // Persist whenever either piece changes.
  useEffect(() => {
    writeJson(STORAGE_KEY, { history, lastReadAt });
  }, [history, lastReadAt]);

  // Stable reference to the live antd message instance for consumers that
  // capture push() in a useEffect.
  const messageRef = useRef(message);
  messageRef.current = message;

  // Track the last (level + text) signature emitted so we can suppress
  // duplicates fired in quick succession (e.g. a polling fetcher that
  // errors 5 times in a row should only show one toast, not five).
  const lastEmitRef = useRef<{ key: string; at: number } | null>(null);
  const DEDUP_WINDOW_MS = 5_000;

  const push = useCallback((level: ToastLevel, text: string) => {
    const now = Date.now();
    const key = `${level}:${text}`;
    const last = lastEmitRef.current;
    if (last && last.key === key && now - last.at < DEDUP_WINDOW_MS) {
      // Within the dedup window — skip the visible toast and the history
      // entry. The first occurrence is enough; we slide the timestamp so
      // the suppression window keeps refreshing while the spam continues.
      lastEmitRef.current = { key, at: now };
      return;
    }
    lastEmitRef.current = { key, at: now };

    messageRef.current[level](text);
    setHistory((prev) => {
      const next: ToastEntry[] = [
        { id: newId(), level, text, at: new Date().toISOString() },
        ...prev,
      ];
      return next.slice(0, MAX_HISTORY);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setLastReadAt(new Date().toISOString());
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    setLastReadAt(new Date().toISOString());
  }, []);

  const unreadCount = useMemo(() => {
    const cutoff = new Date(lastReadAt).getTime();
    return history.filter((h) => new Date(h.at).getTime() > cutoff).length;
  }, [history, lastReadAt]);

  const value = useMemo<ToastHistoryState>(
    () => ({ history, unreadCount, push, markAllRead, clear }),
    [history, unreadCount, push, markAllRead, clear],
  );

  return <ToastHistoryContext.Provider value={value}>{children}</ToastHistoryContext.Provider>;
}

export function useToastHistory() {
  const ctx = useContext(ToastHistoryContext);
  if (!ctx) throw new Error('useToastHistory must be used within ToastHistoryProvider');
  return ctx;
}
