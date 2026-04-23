import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { AppShell } from './components/layout/AppShell';
import { RouteErrorBoundary } from './components/ErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PatientsPage = lazy(() => import('./pages/PatientsPage').then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })));
const ReportsInboxPage = lazy(() => import('./pages/ReportsInboxPage').then((m) => ({ default: m.ReportsInboxPage })));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })));
const ExercisesPage = lazy(() => import('./pages/ExercisesPage').then((m) => ({ default: m.ExercisesPage })));
const LinkingPage = lazy(() => import('./pages/LinkingPage').then((m) => ({ default: m.LinkingPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const IntakeFormsPage = lazy(() => import('./pages/IntakeFormsPage').then((m) => ({ default: m.IntakeFormsPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyAndSetupPage = lazy(() => import('./pages/VerifyAndSetupPage').then((m) => ({ default: m.VerifyAndSetupPage })));

function PageFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 py-4">
      <div className="h-16 animate-pulse rounded-sm bg-secondary" />
      <div className="h-64 animate-pulse rounded-sm bg-secondary" />
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<Suspense fallback={<PageFallback />}><RegisterPage /></Suspense>} />
      <Route path="/verify" element={<Suspense fallback={<PageFallback />}><VerifyAndSetupPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageFallback />}><ForgotPasswordPage /></Suspense>} />
      <Route path="/onboarding" element={<Suspense fallback={<PageFallback />}><OnboardingPage /></Suspense>} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
        <Route path="/patients" element={<Page><PatientsPage /></Page>} />
        <Route path="/patients/:patientId" element={<Page><PatientDetailPage /></Page>} />
        <Route path="/reports" element={<Page><ReportsInboxPage /></Page>} />
        <Route path="/reports/:reportId" element={<Page><ReportDetailPage /></Page>} />
        <Route path="/exercises" element={<Page><ExercisesPage /></Page>} />
        <Route path="/linking" element={<Page><LinkingPage /></Page>} />
        <Route path="/analytics" element={<Page><AnalyticsPage /></Page>} />
        <Route path="/intake-forms" element={<Page><IntakeFormsPage /></Page>} />
        <Route path="/help" element={<Page><HelpPage /></Page>} />
        <Route path="/settings" element={<Page><SettingsPage /></Page>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
