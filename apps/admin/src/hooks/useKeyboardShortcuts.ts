import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardShortcutsOptions {
  onOpenSearch: () => void;
  onOpenHelp: () => void;
  onToggleTheme: () => void;
}

/**
 * useKeyboardShortcuts — Vim-style global navigation.
 *
 *   g u  → Users
 *   g a  → Audit log
 *   g l  → Login events
 *   g r  → Reports
 *   g d  → Dashboard
 *   g s  → Settings
 *   g h  → Help
 *   ?    → Open help/cheatsheet
 *   /    → Focus search (also ⌘K)
 *   t    → Toggle theme
 *
 * The "g + key" sequence is two-step: pressing g enters a transient
 * "leader" mode for ~1.2s during which the next key triggers nav.
 *
 * Shortcuts are suppressed when the user is typing in an input/textarea
 * or any contentEditable element so we don't hijack the form.
 */
export function useKeyboardShortcuts({
  onOpenSearch,
  onOpenHelp,
  onToggleTheme,
}: UseKeyboardShortcutsOptions) {
  const navigate = useNavigate();

  useEffect(() => {
    let leader = false;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    const clearLeader = () => {
      leader = false;
      if (leaderTimer) {
        clearTimeout(leaderTimer);
        leaderTimer = null;
      }
    };

    const isTyping = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const handler = (e: KeyboardEvent) => {
      // Don't hijack typing or modifier-combos (those belong to ⌘K, browser, etc).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      const k = e.key.toLowerCase();

      // Open help with `?` (shift + /).
      if (k === '?') {
        e.preventDefault();
        onOpenHelp();
        return;
      }

      // `/` opens the global search (alongside ⌘K).
      if (k === '/') {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      // `t` toggles the theme.
      if (k === 't' && !leader) {
        e.preventDefault();
        onToggleTheme();
        return;
      }

      // Leader: `g` enters nav-prefix mode.
      if (k === 'g' && !leader) {
        e.preventDefault();
        leader = true;
        leaderTimer = setTimeout(clearLeader, 1200);
        return;
      }

      if (leader) {
        e.preventDefault();
        clearLeader();
        const target: Record<string, string> = {
          d: '/',
          u: '/users',
          a: '/audit-logs',
          l: '/login-events',
          r: '/reports',
          s: '/settings',
          h: '/help',
        };
        if (target[k]) navigate(target[k]);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearLeader();
    };
  }, [navigate, onOpenSearch, onOpenHelp, onToggleTheme]);
}
