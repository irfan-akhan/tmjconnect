import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes (matches server-side HIPAA timeout).
const WARNING_MS = 2 * 60 * 1000; // Warn 2 minutes before expiry.

/**
 * Tracks user activity and logs out on inactivity.
 * Returns `remainingMs` for UI warning display.
 */
export function useSessionTimeout(onWarning?: () => void) {
  const { isAuthenticated, logout } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();

  const resetTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(() => {
      onWarning?.();
    }, SESSION_TIMEOUT_MS - WARNING_MS);

    timerRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }, [logout, onWarning]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    const handler = () => resetTimers();

    for (const e of events) window.addEventListener(e, handler, { passive: true });
    resetTimers();

    return () => {
      for (const e of events) window.removeEventListener(e, handler);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [isAuthenticated, resetTimers]);
}
