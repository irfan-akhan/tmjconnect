import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense } from 'react';
import { ConfigProvider, App as AntdApp, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useThemeMode } from './context/ThemeContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastHistoryProvider } from './context/ToastHistoryContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      staleTime: 30_000, // 30s default — pages override where tighter freshness is needed
    },
  },
});
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';
import { lightTheme, darkTheme } from './theme/antdTheme';
// Lazy-loaded route components live in lazyPages.ts so the same loader is
// shared with the prefetch-on-hover wiring in AdminLayout.
import {
  LoginPage,
  MfaPage,
  DashboardPage,
  UsersPage,
  UserDetailPage,
  AuditLogsPage,
  LoginEventsPage,
  ReportsPage,
  SettingsPage,
  HelpPage,
  NotFoundPage,
  OutboxPage,
  SessionsPage,
  JobsPage,
  ProviderPerformancePage,
  PatientEngagementPage,
  SecurityPage,
  LinkingPage,
  PhiAccessPage,
  NotificationPrefsPage,
  BroadcastsPage,
  SystemMetricsPage,
  ScheduledReportsPage,
  FeatureFlagsPage,
  AnalyticsPage,
} from './lazyPages';
// Centralised dayjs plugin registration — every page that imports from
// `utils/time` triggers this, but importing once at the App root guarantees
// it for the rare consumer that calls dayjs directly.
import './utils/time';

/**
 * Outer fallback — used only for first-paint of the auth pages (Login,
 * Mfa). AdminLayout is eagerly imported, so once the user is past auth the
 * inner Suspense (around `<Outlet />` inside AdminLayout) handles every
 * route swap and this fallback never fires again.
 */
function FirstPaintFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spin size="large" />
    </div>
  );
}

/**
 * Inner shell — needs the ThemeProvider above it so it can read the current
 * mode and pass the right Ant Design theme into ConfigProvider.
 */
function ThemedApp() {
  const { mode } = useThemeMode();
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
        <AntdApp>
          <ToastHistoryProvider>
            <PreferencesProvider>
              <BrowserRouter>
                <AuthProvider>
                  <Suspense fallback={<FirstPaintFallback />}>
                    <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/mfa" element={<MfaPage />} />

                    <Route element={<ProtectedRoute />}>
                      <Route element={<AdminLayout />}>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/users" element={<UsersPage />} />
                        <Route path="/users/:id" element={<UserDetailPage />} />
                        <Route path="/audit-logs" element={<AuditLogsPage />} />
                        <Route path="/login-events" element={<LoginEventsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/help" element={<HelpPage />} />
                        {/* TODO.md feature pages */}
                        <Route path="/outbox" element={<OutboxPage />} />
                        <Route path="/sessions" element={<SessionsPage />} />
                        <Route path="/jobs" element={<JobsPage />} />
                        <Route path="/providers/performance" element={<ProviderPerformancePage />} />
                        <Route path="/patients/engagement" element={<PatientEngagementPage />} />
                        <Route path="/security" element={<SecurityPage />} />
                        <Route path="/linking" element={<LinkingPage />} />
                        <Route path="/phi-access" element={<PhiAccessPage />} />
                        <Route path="/notifications/preferences" element={<NotificationPrefsPage />} />
                        <Route path="/broadcasts" element={<BroadcastsPage />} />
                        <Route path="/system" element={<SystemMetricsPage />} />
                        <Route path="/scheduled-reports" element={<ScheduledReportsPage />} />
                        <Route path="/feature-flags" element={<FeatureFlagsPage />} />
                        <Route path="/analytics" element={<AnalyticsPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                      </Route>
                    </Route>
                    </Routes>
                  </Suspense>
                </AuthProvider>
              </BrowserRouter>
            </PreferencesProvider>
          </ToastHistoryProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
