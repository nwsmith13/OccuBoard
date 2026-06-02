import { BarChart3, Command, FileStack, FileText, LayoutDashboard, LogOut, Menu, PlusCircle, Settings, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { buildOnboardingState, onboardingStorageKey, readBooleanFlag, shouldShowFullOnboarding, writeBooleanFlag } from "../../lib/onboarding.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { CommandPalette } from "../command/CommandPalette.jsx";
import { OnboardingFlow } from "../onboarding/OnboardingFlow.jsx";
import { Button } from "../ui/Button.jsx";
import { Logo } from "./Logo.jsx";

const navItems = [
  { label: "Dashboard", path: "/app/dashboard", icon: LayoutDashboard },
  { label: "Resume Studio", path: "/app/resume-studio", icon: FileText },
  { label: "New Jobs", path: "/app/new-jobs", icon: PlusCircle },
  { label: "Generated Resumes", path: "/app/generated-resumes", icon: FileStack },
  { label: "Applications", path: "/app/applications", icon: BarChart3 },
  { label: "Settings", path: "/app/settings", icon: Settings },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => readBooleanFlag(onboardingStorageKey));
  const { signOut, user, isConfigured } = useAuth();
  const { loadWorkspace, profile, resumeUploads, jobs, jobScores, resumeVersions, loading, loadedFor } = useWorkspaceStore();
  const location = useLocation();
  const current = navItems.find((item) => location.pathname === item.path) ?? navItems.find((item) => location.pathname.startsWith(item.path));
  const onboardingState = useMemo(() => buildOnboardingState({ profile, resumeUploads, jobs, jobScores, resumeVersions }), [jobScores, jobs, profile, resumeUploads, resumeVersions]);

  useEffect(() => {
    loadWorkspace(user);
  }, [loadWorkspace, user]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function dismissOnboarding() {
    writeBooleanFlag(onboardingStorageKey, true);
    setOnboardingDismissed(true);
  }

  const workspaceReady = !loading && loadedFor === (user?.id ?? "local-demo-user");
  if (workspaceReady && shouldShowFullOnboarding(onboardingState, { pathname: location.pathname, dismissed: onboardingDismissed })) {
    return <OnboardingFlow state={onboardingState} onDismiss={dismissOnboarding} />;
  }

  const sidebar = (
    <aside className={`${collapsed ? "w-20" : "w-72"} flex h-full flex-col border-r border-slate-200 bg-white/95 transition-all lg:sticky lg:top-0 lg:h-screen`}>
      <div className={`${collapsed ? "flex min-h-24 flex-col items-center justify-center gap-1 px-2" : "relative flex min-h-28 items-center px-4 py-4"}`}>
        <Link to="/app/dashboard" className={collapsed ? "flex justify-center" : "min-w-0 flex-1 pr-9"}>
          <Logo compact={collapsed} sidebar />
        </Link>
        <button
          type="button"
          className={`${collapsed ? "" : "absolute right-3 top-3"} rounded-lg p-2 text-slate-600 hover:bg-stone-100`}
          onClick={() => setCollapsed((value) => !value)}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>
      <nav className="grid gap-1 px-3">
        {navItems.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            end={end}
            to={path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
                isActive ? "bg-brand-100 text-brand-900" : "text-slate-600 hover:bg-stone-100 hover:text-slate-900"
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-200 p-4">
        {!collapsed && (
          <div className="mb-3 rounded-lg bg-stone-100 p-3 text-sm">
            <div className="font-semibold text-ink">{profile?.email || user?.email || "Local preview"}</div>
            <div className="text-slate-500">{isConfigured ? "Signed in" : "Supabase not configured"}</div>
          </div>
        )}
        <Button variant="ghost" className="w-full justify-start" onClick={isConfigured ? signOut : undefined}>
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#fbfaf8] text-ink">
      <div className="hidden min-h-screen lg:flex">
        {sidebar}
        <main className="min-w-0 flex-1">
          <Header title={current?.label ?? "Dashboard"} onMenu={() => setMobileOpen(true)} onCommand={() => setCommandOpen(true)} />
          <div className="mx-auto max-w-7xl px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <div className="lg:hidden">
        <Header title={current?.label ?? "Dashboard"} onMenu={() => setMobileOpen(true)} onCommand={() => setCommandOpen(true)} />
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-ink/30">
            <div className="h-full max-w-80 bg-white shadow-soft">
              <div className="flex justify-end p-3">
                <button className="rounded-lg p-2 text-slate-700 hover:bg-stone-100" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                  <X size={20} />
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}
        <main className="px-4 py-5">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}

function Header({ title, onMenu, onCommand }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-stone-100 lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu size={21} />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
          <h1 className="text-lg font-bold text-ink">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hidden min-h-10 items-center gap-3 rounded-lg border border-brand-100 bg-white px-3 text-sm font-semibold text-slate-500 shadow-sm transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 sm:inline-flex"
          onClick={onCommand}
          aria-label="Open search or command palette"
        >
          <Command size={16} className="text-brand-700" />
          <span>Search or command...</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">Ctrl K</span>
        </button>
        <Link to="/app/new-jobs" className="hidden sm:block">
          <Button variant="secondary">Analyze a Job</Button>
        </Link>
      </div>
    </header>
  );
}
