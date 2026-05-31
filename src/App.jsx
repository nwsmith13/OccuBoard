import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout.jsx";
import { ProtectedRoute } from "./components/layout/ProtectedRoute.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";

const ApplicationsPage = lazyPage(() => import("./pages/app/ApplicationsPage.jsx"), "ApplicationsPage");
const DashboardPage = lazyPage(() => import("./pages/app/DashboardPage.jsx"), "DashboardPage");
const GeneratedResumesPage = lazyPage(() => import("./pages/app/GeneratedResumesPage.jsx"), "GeneratedResumesPage");
const JobsPage = lazyPage(() => import("./pages/app/JobsPage.jsx"), "JobsPage");
const MessagesPage = lazyPage(() => import("./pages/app/MessagesPage.jsx"), "MessagesPage");
const NewJobsPage = lazyPage(() => import("./pages/app/NewJobsPage.jsx"), "NewJobsPage");
const ResumeStudioPage = lazyPage(() => import("./pages/app/ResumeStudioPage.jsx"), "ResumeStudioPage");
const SettingsPage = lazyPage(() => import("./pages/app/SettingsPage.jsx"), "SettingsPage");
const LoginPage = lazyPage(() => import("./pages/auth/LoginPage.jsx"), "LoginPage");
const SignUpPage = lazyPage(() => import("./pages/auth/SignUpPage.jsx"), "SignUpPage");
const LandingPage = lazyPage(() => import("./pages/LandingPage.jsx"), "LandingPage");

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : withPageFallback(<LandingPage />)} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : withPageFallback(<LoginPage />)} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : withPageFallback(<SignUpPage />)} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={withPageFallback(<DashboardPage />, true)} />
        <Route path="new-jobs" element={withPageFallback(<NewJobsPage />, true)} />
        <Route path="generated-resumes" element={withPageFallback(<GeneratedResumesPage />, true)} />
        <Route path="jobs" element={<Navigate to="/app/new-jobs" replace />} />
        <Route path="job-tracker" element={withPageFallback(<JobsPage />, true)} />
        <Route path="applications" element={withPageFallback(<ApplicationsPage />, true)} />
        <Route path="applications/:applicationId" element={withPageFallback(<ApplicationsPage />, true)} />
        <Route path="resume-studio" element={withPageFallback(<ResumeStudioPage />, true)} />
        <Route path="messages" element={withPageFallback(<MessagesPage />, true)} />
        <Route path="settings" element={withPageFallback(<SettingsPage />, true)} />
      </Route>
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/resume-studio" element={<Navigate to="/app/resume-studio" replace />} />
      <Route path="/new-jobs" element={<Navigate to="/app/new-jobs" replace />} />
      <Route path="/generated-resumes" element={<Navigate to="/app/generated-resumes" replace />} />
      <Route path="/applications" element={<Navigate to="/app/applications" replace />} />
      <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function lazyPage(loader, exportName) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] ?? module.default })));
}

function withPageFallback(element, compact = false) {
  return <Suspense fallback={<RouteFallback compact={compact} />}>{element}</Suspense>;
}

function RouteFallback({ compact = false }) {
  if (compact) {
    return (
      <div className="grid gap-4">
        <div className="h-28 rounded-xl bg-white/80 shadow-sm" />
        <div className="h-64 rounded-xl bg-white/80 shadow-sm" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfaf8] p-4 text-ink sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-4">
        <div className="h-16 rounded-lg bg-white/80 shadow-sm" />
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="hidden rounded-lg bg-white/70 shadow-sm lg:block" />
          <div className="grid gap-4">
            <div className="h-36 rounded-xl bg-white/80 shadow-sm" />
            <div className="h-64 rounded-xl bg-white/80 shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
