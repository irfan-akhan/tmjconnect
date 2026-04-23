import { lazy } from 'react';

/**
 * lazyPages.ts — central registry of lazy-loaded route components.
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
// TODO.md feature pages
const outboxLoader = () => import('./pages/OutboxPage');
const sessionsLoader = () => import('./pages/SessionsPage');
const jobsLoader = () => import('./pages/JobsPage');
const providerPerfLoader = () => import('./pages/ProviderPerformancePage');
const patientEngagementLoader = () => import('./pages/PatientEngagementPage');
const securityLoader = () => import('./pages/SecurityPage');
const linkingLoader = () => import('./pages/LinkingPage');
const phiAccessLoader = () => import('./pages/PhiAccessPage');
const notifPrefsLoader = () => import('./pages/NotificationPrefsPage');
const broadcastsLoader = () => import('./pages/BroadcastsPage');
const systemMetricsLoader = () => import('./pages/SystemMetricsPage');
const scheduledReportsLoader = () => import('./pages/ScheduledReportsPage');
const featureFlagsLoader = () => import('./pages/FeatureFlagsPage');
const analyticsLoader = () => import('./pages/AnalyticsPage');

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
// TODO.md pages
export const OutboxPage = lazy(outboxLoader);
export const SessionsPage = lazy(sessionsLoader);
export const JobsPage = lazy(jobsLoader);
export const ProviderPerformancePage = lazy(providerPerfLoader);
export const PatientEngagementPage = lazy(patientEngagementLoader);
export const SecurityPage = lazy(securityLoader);
export const LinkingPage = lazy(linkingLoader);
export const PhiAccessPage = lazy(phiAccessLoader);
export const NotificationPrefsPage = lazy(notifPrefsLoader);
export const BroadcastsPage = lazy(broadcastsLoader);
export const SystemMetricsPage = lazy(systemMetricsLoader);
export const ScheduledReportsPage = lazy(scheduledReportsLoader);
export const FeatureFlagsPage = lazy(featureFlagsLoader);
export const AnalyticsPage = lazy(analyticsLoader);

const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/': dashboardLoader,
  '/users': usersLoader,
  '/audit-logs': auditLogsLoader,
  '/login-events': loginEventsLoader,
  '/reports': reportsLoader,
  '/settings': settingsLoader,
  '/help': helpLoader,
  '/outbox': outboxLoader,
  '/sessions': sessionsLoader,
  '/jobs': jobsLoader,
  '/providers/performance': providerPerfLoader,
  '/patients/engagement': patientEngagementLoader,
  '/security': securityLoader,
  '/linking': linkingLoader,
  '/phi-access': phiAccessLoader,
  '/notifications/preferences': notifPrefsLoader,
  '/broadcasts': broadcastsLoader,
  '/system': systemMetricsLoader,
  '/scheduled-reports': scheduledReportsLoader,
  '/feature-flags': featureFlagsLoader,
  '/analytics': analyticsLoader,
};

export function prefetchRoute(path: string): void {
  prefetchMap[path]?.();
}
