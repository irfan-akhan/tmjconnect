import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout, Menu, Modal, Avatar, Dropdown, Tooltip, Badge, Drawer } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  AuditOutlined,
  LoginOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  SettingOutlined,
  UserOutlined,
  HeartFilled,
  SunOutlined,
  MoonOutlined,
  SearchOutlined,
  QuestionCircleOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { usePreferences } from '../context/PreferencesContext';
import { useToastHistory } from '../context/ToastHistoryContext';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import GlobalSearch from '../components/GlobalSearch';
import HelpModal from '../components/HelpModal';
import ToastHistoryDrawer from '../components/ToastHistoryDrawer';
import RecentlyViewedMenu from '../components/RecentlyViewedMenu';
import ReadOnlyBanner from '../components/ReadOnlyBanner';
import ErrorBoundary from '../components/ErrorBoundary';
import { prefetchRoute } from '../lazyPages';

const { Header, Sider, Content } = Layout;

/** Grouped sidebar nav. Each group renders with a small subheading label. */
const navGroups: { label: string; items: { key: string; icon: ReactNode; label: string }[] }[] = [
  {
    label: 'Overview',
    items: [{ key: '/', icon: <DashboardOutlined />, label: 'Dashboard' }],
  },
  {
    label: 'Management',
    items: [
      { key: '/users', icon: <TeamOutlined />, label: 'Users' },
      { key: '/reports', icon: <FileTextOutlined />, label: 'Reports' },
    ],
  },
  {
    label: 'Security',
    items: [
      { key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' },
      { key: '/login-events', icon: <LoginOutlined />, label: 'Login Events' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
      { key: '/help', icon: <QuestionCircleOutlined />, label: 'Help' },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

const segmentLabels: Record<string, string> = {
  users: 'Users',
  'audit-logs': 'Audit Logs',
  'login-events': 'Login Events',
  reports: 'Reports',
  settings: 'Settings',
  help: 'Help',
};

/** Build breadcrumb segments: [{ label, href? }, ...] */
function buildBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  if (pathname === '/') return [{ label: 'Dashboard' }];
  const segs = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];

  if (segs[0] && segmentLabels[segs[0]]) {
    if (segs.length > 1) {
      // e.g. /users/:id → "Users" link + "User Detail" final
      crumbs.push({ label: segmentLabels[segs[0]], href: `/${segs[0]}` });
      crumbs.push({ label: segs[0] === 'users' ? 'User Detail' : segs[1] });
    } else {
      crumbs.push({ label: segmentLabels[segs[0]] });
    }
  } else {
    crumbs.push({ label: segs[0] ?? 'Admin' });
  }
  return crumbs;
}

export default function AdminLayout() {
  const [sessionWarning, setSessionWarning] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [toastDrawerOpen, setToastDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggle: toggleTheme } = useThemeMode();
  const { readOnly, setReadOnly, sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  // Local alias so the rest of the layout reads cleanly.
  const collapsed = sidebarCollapsed;
  const setCollapsed = setSidebarCollapsed;
  const { unreadCount } = useToastHistory();
  const navigate = useNavigate();
  const location = useLocation();

  const onWarning = useCallback(() => setSessionWarning(true), []);
  useSessionTimeout(onWarning);

  // Global vim-style shortcuts. Memoised callbacks aren't necessary here
  // because the hook only re-binds when the identity changes — these
  // closures are stable across renders since they delegate to setState.
  useKeyboardShortcuts({
    onOpenSearch: () => setSearchOpen(true),
    onOpenHelp: () => setHelpOpen(true),
    onToggleTheme: toggleTheme,
  });

  const selectedKey =
    allItems.find((item) => {
      if (item.key === '/') return location.pathname === '/';
      return location.pathname.startsWith(item.key);
    })?.key ?? '/';

  // Build menu items grouped with type:'group'.
  // Each item label is wrapped in a span that calls `prefetchRoute()` on
  // hover so the lazy chunk is already in cache by the time the user clicks.
  // Vite memoises the dynamic-import promise, so repeated hovers are no-ops.
  const menuItems = navGroups.flatMap((group, gi) => [
    {
      type: 'group' as const,
      key: `g-${gi}`,
      label: !collapsed ? (
        <div className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {group.label}
        </div>
      ) : null,
    },
    ...group.items.map((item) => ({
      key: item.key,
      icon: item.icon,
      label: (
        <span onMouseEnter={() => prefetchRoute(item.key)}>{item.label}</span>
      ),
    })),
  ]);

  const userInitials = (user?.email ?? '?').slice(0, 2).toUpperCase();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // The sidebar content is shared between the permanent desktop Sider and
  // the mobile Drawer. Extract it into a fragment to avoid duplication.
  const sidebarContent = (
    <>
      {/* Brand */}
      <div className={`flex h-16 items-center ${collapsed && !mobileDrawerOpen ? 'justify-center' : 'px-5'}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md">
            <HeartFilled style={{ fontSize: 18 }} />
          </div>
          {(!collapsed || mobileDrawerOpen) && (
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-white">
                TMJConnect
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Admin Console
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="mt-2">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileDrawerOpen(false);
          }}
          style={{ background: 'transparent', borderInlineEnd: 'none' }}
        />
      </div>

      {/* User card pinned to bottom */}
      {(!collapsed || mobileDrawerOpen) && user && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="rounded-lg border border-slate-800 bg-slate-800/40 p-3">
            <div className="flex items-center gap-3">
              <Avatar
                size={36}
                style={{ background: '#0D9488', fontWeight: 600, fontSize: 13 }}
              >
                {userInitials}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">{user.email}</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Administrator
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <Layout className="min-h-screen">
      {/* ─── Mobile drawer (< lg) ────────────────────────────────────────── */}
      <Drawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        placement="left"
        width={260}
        closable={false}
        styles={{
          body: { padding: 0, background: '#0F172A', position: 'relative', minHeight: '100%' },
        }}
        className="lg:!hidden"
      >
        {sidebarContent}
      </Drawer>

      {/* ─── Desktop sidebar (>= lg) ─────────────────────────────────────── */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={248}
        collapsedWidth={76}
        className="dark-scrollbar !hidden lg:!block"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          borderRight: '1px solid #1E293B',
        }}
      >
        {sidebarContent}
      </Sider>

      {/* ─── Main column ─────────────────────────────────────────────────── */}
      <Layout>
        <Header
          className="flex items-center justify-between border-b border-slate-200 dark:border-white/[0.06]"
          style={{ padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile: open drawer. Desktop: collapse/expand sidebar. */}
            <button
              type="button"
              onClick={() => {
                // Below lg breakpoint → open mobile drawer
                if (window.innerWidth < 1024) {
                  setMobileDrawerOpen(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Admin
              </Link>
              {buildBreadcrumbs(location.pathname).map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  <span className="text-slate-300 dark:text-slate-600">/</span>
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ─── Cmd+K search trigger ─────────────────────────────────── */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 dark:border-white/[0.06] dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700 sm:flex"
              aria-label="Open search"
            >
              <SearchOutlined />
              <span>Search…</span>
              <kbd className="ml-3 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* ─── Read-only toggle ────────────────────────────────────── */}
            <Tooltip title={readOnly ? 'Disable read-only mode' : 'Enable read-only mode'}>
              <button
                type="button"
                onClick={() => setReadOnly(!readOnly)}
                className={`flex h-9 w-9 items-center justify-center rounded-md transition ${
                  readOnly
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
                aria-label="Toggle read-only mode"
              >
                {readOnly ? <LockOutlined /> : <UnlockOutlined />}
              </button>
            </Tooltip>

            {/* ─── Recently viewed ─────────────────────────────────────── */}
            <RecentlyViewedMenu />

            {/* ─── Help ────────────────────────────────────────────────── */}
            <Tooltip title="Keyboard shortcuts (?)">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Help"
              >
                <QuestionCircleOutlined />
              </button>
            </Tooltip>

            {/* ─── Theme toggle ────────────────────────────────────────── */}
            <Tooltip title={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Toggle theme"
              >
                {mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
              </button>
            </Tooltip>

            {/* ─── Toast history bell ──────────────────────────────────── */}
            <Tooltip title="Notifications">
              <button
                type="button"
                onClick={() => setToastDrawerOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Notifications"
              >
                <Badge count={unreadCount} size="small" offset={[-2, 2]} color="#0D9488">
                  <BellOutlined />
                </Badge>
              </button>
            </Tooltip>

            <Dropdown
              placement="bottomRight"
              menu={{
                items: [
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: <span className="text-sm">{user?.email}</span>,
                    disabled: true,
                  },
                  { type: 'divider' },
                  {
                    key: 'theme',
                    icon: mode === 'light' ? <MoonOutlined /> : <SunOutlined />,
                    label: mode === 'light' ? 'Switch to dark' : 'Switch to light',
                    onClick: toggleTheme,
                  },
                  {
                    key: 'settings',
                    icon: <SettingOutlined />,
                    label: 'Settings',
                    onClick: () => navigate('/settings'),
                  },
                  {
                    key: 'help',
                    icon: <QuestionCircleOutlined />,
                    label: 'Help & shortcuts',
                    onClick: () => setHelpOpen(true),
                  },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: logout },
                ],
              }}
            >
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar size={32} style={{ background: '#0D9488', fontWeight: 600, fontSize: 12 }}>
                  {userInitials}
                </Avatar>
                <span className="hidden text-sm font-medium text-slate-700 dark:text-slate-200 sm:inline">
                  {user?.email?.split('@')[0]}
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ padding: '28px 32px', minHeight: 'calc(100vh - 64px)' }}>
          <ReadOnlyBanner />
          {/*
            Inner Suspense — catches lazy route chunks WITHOUT unmounting
            the sidebar/topbar. Fallback is `null` so cached chunks (post-
            hover-prefetch) navigate instantly with no flicker. Cold chunks
            briefly render an empty content area, which feels like a fast
            page transition rather than a layout reset.
          */}
          <ErrorBoundary>
            <Suspense fallback={null}>
              {/* Key on pathname triggers the CSS `page-enter` fade on route swap. */}
              <div key={location.pathname} className="page-enter">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>

      {/* Session expiry modal */}
      <Modal
        title="Session expiring"
        open={sessionWarning}
        onOk={() => setSessionWarning(false)}
        onCancel={logout}
        okText="Stay logged in"
        cancelText="Sign out"
      >
        <p className="text-slate-600 dark:text-slate-300">
          Your session will expire in 2 minutes due to inactivity. Choose <strong>Stay logged in</strong> to continue.
        </p>
      </Modal>

      {/* Global Cmd+K search — listens for the shortcut even when closed */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Global help modal */}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Toast history drawer */}
      <ToastHistoryDrawer open={toastDrawerOpen} onClose={() => setToastDrawerOpen(false)} />
    </Layout>
  );
}
