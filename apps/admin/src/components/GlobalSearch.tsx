import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Input, Spin, Empty } from 'antd';
import {
  SearchOutlined,
  TeamOutlined,
  AuditOutlined,
  FileTextOutlined,
  LoginOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  SunOutlined,
  MoonOutlined,
  LockOutlined,
  UnlockOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useThemeMode } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserHit {
  type: 'user';
  id: string;
  email: string;
  role: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface AuditHit {
  type: 'audit';
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  created_at: string;
}

interface LoginHit {
  type: 'login';
  id: string;
  email: string;
  success: boolean;
  ip_address: string;
  created_at: string;
}

/** Action commands — pure-frontend operations the palette can execute. */
interface ActionHit {
  type: 'action';
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

type Hit = UserHit | AuditHit | LoginHit | ActionHit;

interface SearchResults {
  actions: ActionHit[];
  users: UserHit[];
  audit: AuditHit[];
  logins: LoginHit[];
}

const EMPTY: SearchResults = { actions: [], users: [], audit: [], logins: [] };

/**
 * GlobalSearch — Cmd+K command palette.
 *
 * Calls the existing list endpoints with the user's query as a filter, since
 * a dedicated `/admin/search` endpoint doesn't exist yet (see TODO.md #11).
 * The three slices (users, audit, logins) are fetched in parallel and shown
 * as grouped results.
 *
 * Keyboard:
 *   ⌘K  / Ctrl+K   → open
 *   ↑ ↓            → move highlight
 *   Enter          → navigate to highlighted result
 *   Esc            → close
 */
export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { mode, toggle: toggleTheme } = useThemeMode();
  const { readOnly, setReadOnly } = usePreferences();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [highlight, setHighlight] = useState(0);

  // ─── Static action commands — fuzzy-matched against the query ───────
  const allActions: ActionHit[] = useMemo(
    () => [
      {
        type: 'action',
        id: 'go-dashboard',
        label: 'Go to Dashboard',
        hint: 'g d',
        icon: <ArrowRightOutlined />,
        run: () => navigate('/'),
      },
      {
        type: 'action',
        id: 'go-users',
        label: 'Go to Users',
        hint: 'g u',
        icon: <TeamOutlined />,
        run: () => navigate('/users'),
      },
      {
        type: 'action',
        id: 'go-audit',
        label: 'Go to Audit logs',
        hint: 'g a',
        icon: <AuditOutlined />,
        run: () => navigate('/audit-logs'),
      },
      {
        type: 'action',
        id: 'go-logins',
        label: 'Go to Login events',
        hint: 'g l',
        icon: <LoginOutlined />,
        run: () => navigate('/login-events'),
      },
      {
        type: 'action',
        id: 'go-reports',
        label: 'Go to Reports',
        hint: 'g r',
        icon: <FileTextOutlined />,
        run: () => navigate('/reports'),
      },
      {
        type: 'action',
        id: 'go-settings',
        label: 'Settings',
        hint: 'g s',
        icon: <SettingOutlined />,
        run: () => navigate('/settings'),
      },
      {
        type: 'action',
        id: 'go-help',
        label: 'Help & shortcuts',
        hint: 'g h',
        icon: <QuestionCircleOutlined />,
        run: () => navigate('/help'),
      },
      {
        type: 'action',
        id: 'go-outbox',
        label: 'Go to Outbox monitor',
        icon: <FileTextOutlined />,
        run: () => navigate('/outbox'),
      },
      {
        type: 'action',
        id: 'go-sessions',
        label: 'Go to Active sessions',
        icon: <TeamOutlined />,
        run: () => navigate('/sessions'),
      },
      {
        type: 'action',
        id: 'go-jobs',
        label: 'Go to Jobs',
        icon: <AuditOutlined />,
        run: () => navigate('/jobs'),
      },
      {
        type: 'action',
        id: 'go-provider-perf',
        label: 'Go to Provider performance',
        icon: <TeamOutlined />,
        run: () => navigate('/providers/performance'),
      },
      {
        type: 'action',
        id: 'go-patient-engagement',
        label: 'Go to Patient engagement',
        icon: <TeamOutlined />,
        run: () => navigate('/patients/engagement'),
      },
      {
        type: 'action',
        id: 'go-security',
        label: 'Go to Security operations',
        icon: <LockOutlined />,
        run: () => navigate('/security'),
      },
      {
        type: 'action',
        id: 'go-linking',
        label: 'Go to Linking',
        icon: <LoginOutlined />,
        run: () => navigate('/linking'),
      },
      {
        type: 'action',
        id: 'go-phi',
        label: 'Go to PHI access reports',
        icon: <AuditOutlined />,
        run: () => navigate('/phi-access'),
      },
      {
        type: 'action',
        id: 'go-broadcasts',
        label: 'Go to Broadcasts',
        icon: <FileTextOutlined />,
        run: () => navigate('/broadcasts'),
      },
      {
        type: 'action',
        id: 'go-system',
        label: 'Go to System metrics',
        icon: <ThunderboltOutlined />,
        run: () => navigate('/system'),
      },
      {
        type: 'action',
        id: 'go-scheduled',
        label: 'Go to Scheduled reports',
        icon: <FileTextOutlined />,
        run: () => navigate('/scheduled-reports'),
      },
      {
        type: 'action',
        id: 'go-flags',
        label: 'Go to Feature flags',
        icon: <SettingOutlined />,
        run: () => navigate('/feature-flags'),
      },
      {
        type: 'action',
        id: 'toggle-theme',
        label: mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
        hint: 't',
        icon: mode === 'light' ? <MoonOutlined /> : <SunOutlined />,
        run: toggleTheme,
      },
      {
        type: 'action',
        id: 'toggle-read-only',
        label: readOnly ? 'Disable read-only mode' : 'Enable read-only mode',
        icon: readOnly ? <UnlockOutlined /> : <LockOutlined />,
        run: () => setReadOnly(!readOnly),
      },
    ],
    [mode, readOnly, navigate, toggleTheme, setReadOnly],
  );

  // ─── Global ⌘K listener — open the modal from anywhere ───────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  // Reset state when the modal closes
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
      setResults(EMPTY);
      setHighlight(0);
    }
  }, [open]);

  // Debounce the query so we don't fire 30 requests while the user types
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch when the debounced query changes
  useEffect(() => {
    // Always show matching actions even on a short query.
    const matchingActions =
      debounced.length === 0
        ? allActions.slice(0, 6)
        : allActions.filter((a) => a.label.toLowerCase().includes(debounced.toLowerCase())).slice(0, 6);

    if (!debounced || debounced.length < 2) {
      setResults({ ...EMPTY, actions: matchingActions });
      setHighlight(0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // TODO #11: Try the server-side global search endpoint first. If it's
    // not deployed yet (404) or errors, fall back to the per-endpoint
    // filter approach below.
    api.get('/admin/search', { params: { q: debounced, types: 'user,report,audit_log' } })
      .then(({ data }) => {
        if (cancelled) return;
        const users: UserHit[] = (data.data?.users ?? []).map((u: Record<string, unknown>) => ({
          type: 'user' as const, ...u,
        })) as UserHit[];
        const audit: AuditHit[] = (data.data?.audit_logs ?? []).map((a: Record<string, unknown>) => ({
          type: 'audit' as const, ...a,
        })) as AuditHit[];
        setResults({ actions: matchingActions, users, audit, logins: [] });
        setHighlight(0);
      })
      .catch(async () => {
        // Fallback — server search not deployed. Use the multi-endpoint approach.
        if (cancelled) return;
        const [uRes, aRes, lRes] = await Promise.allSettled([
          api.get('/admin/users', { params: { search: debounced, page: 1, limit: 5 } }),
          api.get('/admin/audit-logs', { params: { action: debounced, page: 1, limit: 5 } }),
          /^[0-9a-f]{4,}/i.test(debounced)
            ? api.get('/admin/login-events', { params: { user_id: debounced, page: 1, limit: 5 } })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        const users: UserHit[] =
          uRes.status === 'fulfilled'
            ? uRes.value.data.data.map((u: Omit<UserHit, 'type'>) => ({ ...u, type: 'user' as const }))
            : [];
        const audit: AuditHit[] =
          aRes.status === 'fulfilled'
            ? aRes.value.data.data.map((a: Omit<AuditHit, 'type'>) => ({ ...a, type: 'audit' as const }))
            : [];
        const logins: LoginHit[] =
          lRes.status === 'fulfilled' && lRes.value
            ? lRes.value.data.data.map((l: Omit<LoginHit, 'type'>) => ({ ...l, type: 'login' as const }))
            : [];
        setResults({ actions: matchingActions, users, audit, logins });
        setHighlight(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, allActions]);

  // Flatten results for keyboard navigation
  const flatHits: Hit[] = useMemo(
    () => [...results.actions, ...results.users, ...results.audit, ...results.logins],
    [results],
  );

  const goToHit = (hit: Hit) => {
    onOpenChange(false);
    if (hit.type === 'action') hit.run();
    if (hit.type === 'user') navigate(`/users/${hit.id}`);
    if (hit.type === 'audit') navigate('/audit-logs');
    if (hit.type === 'login') navigate('/login-events');
  };

  // Handle ↑/↓/Enter inside the modal
  const handleKey = (e: React.KeyboardEvent) => {
    if (flatHits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % flatHits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + flatHits.length) % flatHits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goToHit(flatHits[highlight]);
    }
  };

  // Track refs to scroll the highlighted item into view
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    itemRefs.current[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  let cursor = -1;
  const renderHit = (hit: Hit) => {
    cursor++;
    const idx = cursor;
    const isHighlighted = idx === highlight;
    const baseCls = `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${
      isHighlighted
        ? 'bg-brand-50 text-brand-700 dark:bg-slate-700 dark:text-brand-300'
        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50'
    }`;

    if (hit.type === 'action') {
      return (
        <button
          key={`act-${hit.id}`}
          ref={(el) => (itemRefs.current[idx] = el)}
          type="button"
          className={baseCls}
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => goToHit(hit)}
        >
          <span className="text-slate-400">{hit.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{hit.label}</div>
          </div>
          {hit.hint && (
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {hit.hint}
            </kbd>
          )}
        </button>
      );
    }

    if (hit.type === 'user') {
      const name =
        [hit.first_name, hit.last_name].filter(Boolean).join(' ') || hit.email.split('@')[0];
      return (
        <button
          key={`u-${hit.id}`}
          ref={(el) => (itemRefs.current[idx] = el)}
          type="button"
          className={baseCls}
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => goToHit(hit)}
        >
          <TeamOutlined className="text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{hit.email}</div>
          </div>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {hit.role}
          </span>
          <ArrowRightOutlined className="text-slate-400" />
        </button>
      );
    }

    if (hit.type === 'audit') {
      return (
        <button
          key={`a-${hit.id}`}
          ref={(el) => (itemRefs.current[idx] = el)}
          type="button"
          className={baseCls}
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => goToHit(hit)}
        >
          <AuditOutlined className="text-slate-400" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{hit.action}</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
              {hit.resource_type ?? 'no resource'}
              {hit.resource_id ? `:${hit.resource_id.slice(0, 8)}` : ''}
            </div>
          </div>
          <ArrowRightOutlined className="text-slate-400" />
        </button>
      );
    }

    return (
      <button
        key={`l-${hit.id}`}
        ref={(el) => (itemRefs.current[idx] = el)}
        type="button"
        className={baseCls}
        onMouseEnter={() => setHighlight(idx)}
        onClick={() => goToHit(hit)}
      >
        <LoginOutlined className="text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{hit.email}</div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
            {hit.success ? 'Success' : 'Failed'} · {hit.ip_address}
          </div>
        </div>
        <ArrowRightOutlined className="text-slate-400" />
      </button>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      closable={false}
      width={640}
      destroyOnClose
      style={{ top: 80 }}
      styles={{ body: { padding: 0 } }}
    >
      <div onKeyDown={handleKey}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
          <SearchOutlined className="text-lg text-slate-400" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users, actions, IDs…"
            variant="borderless"
            style={{ padding: 0, fontSize: 15 }}
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            ESC
          </kbd>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spin />
            </div>
          )}

          {!loading && results.actions.length > 0 && (
            <Section label="Actions">
              {results.actions.map(renderHit)}
            </Section>
          )}

          {!loading && debounced.length < 2 && results.actions.length === 0 && (
            <div className="px-3 py-8 text-center">
              <ThunderboltOutlined className="text-2xl text-slate-300 dark:text-slate-600" />
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Type at least 2 characters to search users, audit, or logins.
              </div>
              <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
                Tip: try "deactivate", "audit", or paste a user ID.
              </div>
            </div>
          )}

          {!loading && debounced.length >= 2 && flatHits.length === 0 && (
            <div className="py-8">
              <Empty description="No matches" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}

          {!loading && results.users.length > 0 && (
            <Section label="Users">{results.users.map(renderHit)}</Section>
          )}
          {!loading && results.audit.length > 0 && (
            <Section label="Audit log">{results.audit.map(renderHit)}</Section>
          )}
          {!loading && results.logins.length > 0 && (
            <Section label="Login events">{results.logins.map(renderHit)}</Section>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-700">↑</kbd>{' '}
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-700">↓</kbd> navigate
            </span>
            <span>
              <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono dark:bg-slate-700">↵</kbd> open
            </span>
          </div>
          <span>Press ⌘K from anywhere</span>
        </div>
      </div>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
