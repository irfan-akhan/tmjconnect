import { lazy } from 'react';

/**
 * lazyPages.ts — central registry of lazy-loaded route components.
 *
 * Why this lives in its own file:
 *   1. The same loader function is shared by `React.lazy()` AND
 *      `prefetchRoute()`. Vite/Rollup memoise the dynamic-import promise the
 *      first time a loader is called, so a `prefetchRoute('/users')` on
 *      hover and a subsequent click on the menu item resolve to the same
 *      module — no double-fetch, no race.
 *   2. AdminLayout can call `prefetchRoute(item.key)` on menu hover
 *      without coupling the layout to App.tsx's route table.
 *
 * To add a new lazy page:
 *   - declare a `xxxLoader` const
 *   - export `lazy(xxxLoader)` for the router
 *   - if it should prefetch on hover, add it to `prefetchMap`
 */

const dashboardLoader = () => import('./pages/DashboardPage');
const usersLoader = () => import('./pages/UsersPage');
const userDetailLoader = () => import('./pages/UserDetailPage');
const auditLogsLoader = () => import('./pages/AuditLogsPage');
const loginEventsLoader = () => import('./pages/LoginEventsPage');
const reportsLoader = () => import('./pages/ReportsPage');
const settingsLoader = () => import('./pages/SettingsPage');
const helpLoader = () => import('./pages/HelpPage');
const notFoundLoader = () => import('./pages/NotFoundPage');
const loginLoader = () => import('./pages/LoginPage');
const mfaLoader = () => import('./pages/MfaPage');

export const DashboardPage = lazy(dashboardLoader);
export const UsersPage = lazy(usersLoader);
export const UserDetailPage = lazy(userDetailLoader);
export const AuditLogsPage = lazy(auditLogsLoader);
export const LoginEventsPage = lazy(loginEventsLoader);
export const ReportsPage = lazy(reportsLoader);
export const SettingsPage = lazy(settingsLoader);
export const HelpPage = lazy(helpLoader);
export const NotFoundPage = lazy(notFoundLoader);
export const LoginPage = lazy(loginLoader);
export const MfaPage = lazy(mfaLoader);

/** Map of sidebar nav paths → their dynamic-import loaders. */
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/': dashboardLoader,
  '/users': usersLoader,
  '/audit-logs': auditLogsLoader,
  '/login-events': loginEventsLoader,
  '/reports': reportsLoader,
  '/settings': settingsLoader,
  '/help': helpLoader,
};

/**
 * Trigger the dynamic import for a given route. Idempotent — calling it
 * twice resolves to the cached module promise. Safe to fire on every hover.
 */
export function prefetchRoute(path: string): void {
  prefetchMap[path]?.();
}
