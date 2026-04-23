import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from 'react';
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
    return (_jsxs("div", { className: "mx-auto max-w-6xl space-y-8 py-4", children: [_jsx("div", { className: "h-16 animate-pulse rounded-sm bg-secondary" }), _jsx("div", { className: "h-64 animate-pulse rounded-sm bg-secondary" })] }));
}
function Page({ children }) {
    return (_jsx(RouteErrorBoundary, { children: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: children }) }));
}
export function App() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(RegisterPage, {}) }) }), _jsx(Route, { path: "/verify", element: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(VerifyAndSetupPage, {}) }) }), _jsx(Route, { path: "/forgot-password", element: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(ForgotPasswordPage, {}) }) }), _jsx(Route, { path: "/onboarding", element: _jsx(Suspense, { fallback: _jsx(PageFallback, {}), children: _jsx(OnboardingPage, {}) }) }), _jsxs(Route, { element: _jsx(RequireAuth, { children: _jsx(AppShell, {}) }), children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/dashboard", replace: true }) }), _jsx(Route, { path: "/dashboard", element: _jsx(Page, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "/patients", element: _jsx(Page, { children: _jsx(PatientsPage, {}) }) }), _jsx(Route, { path: "/patients/:patientId", element: _jsx(Page, { children: _jsx(PatientDetailPage, {}) }) }), _jsx(Route, { path: "/reports", element: _jsx(Page, { children: _jsx(ReportsInboxPage, {}) }) }), _jsx(Route, { path: "/reports/:reportId", element: _jsx(Page, { children: _jsx(ReportDetailPage, {}) }) }), _jsx(Route, { path: "/exercises", element: _jsx(Page, { children: _jsx(ExercisesPage, {}) }) }), _jsx(Route, { path: "/linking", element: _jsx(Page, { children: _jsx(LinkingPage, {}) }) }), _jsx(Route, { path: "/analytics", element: _jsx(Page, { children: _jsx(AnalyticsPage, {}) }) }), _jsx(Route, { path: "/intake-forms", element: _jsx(Page, { children: _jsx(IntakeFormsPage, {}) }) }), _jsx(Route, { path: "/help", element: _jsx(Page, { children: _jsx(HelpPage, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(Page, { children: _jsx(SettingsPage, {}) }) })] }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
