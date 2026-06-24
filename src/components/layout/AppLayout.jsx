import { BarChart3, Command, FileStack, FileText, HelpCircle, LayoutDashboard, LogOut, Menu, PlusCircle, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { buildOnboardingState, clearEmailConfirmation, clearProductTourRestart, getRestartedTourState, onboardingStorageKey, onboardingTrackerDismissedKey, onboardingUpdatedEvent, readBooleanFlag, readEmailConfirmation, readProductTourRestart, shouldShowFullOnboarding, writeBooleanFlag } from "../../lib/onboarding.js";
import { openFeedbackEvent, openHelpCenterEvent } from "../../lib/helpCenter.js";
import { trackProductEvent } from "../../lib/productAnalytics.js";
import { isProSubscription } from "../../lib/billing.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { CommandPalette } from "../command/CommandPalette.jsx";
import { FeedbackModal } from "../help/FeedbackModal.jsx";
import { HelpCenter } from "../help/HelpCenter.jsx";
import { CompletionRibbon, GettingStartedRibbon } from "../onboarding/GettingStartedRibbon.jsx";
import { OnboardingFlow } from "../onboarding/OnboardingFlow.jsx";
import { Button } from "../ui/Button.jsx";
import { Logo } from "./Logo.jsx";

const navItems = [
  { label: "Dashboard", path: "/app/dashboard", icon: LayoutDashboard },
  { label: "Resume Studio", path: "/app/resume-studio", icon: FileText },
  { label: "Analyze Jobs", path: "/app/new-jobs", icon: PlusCircle },
  { label: "Generated Resumes", path: "/app/generated-resumes", icon: FileStack },
  { label: "Applications", path: "/app/applications", icon: BarChart3 },
  { label: "Settings", path: "/app/settings", icon: Settings },
];
const sidebarPreferenceKey = "occuboard-sidebar-collapsed";

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = window.localStorage.getItem(sidebarPreferenceKey);
    if (saved !== null) return saved === "true";
    return window.matchMedia("(min-width: 1024px) and (max-width: 1279px)").matches;
  });
  const [hasManualSidebarPreference, setHasManualSidebarPreference] = useState(() => window.localStorage.getItem(sidebarPreferenceKey) !== null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpCenter, setHelpCenter] = useState({ open: false, section: "" });
  const [feedbackModal, setFeedbackModal] = useState({ open: false, type: "Feedback" });
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => readBooleanFlag(onboardingStorageKey));
  const [trackerDismissed, setTrackerDismissed] = useState(() => readBooleanFlag(onboardingTrackerDismissedKey));
  const [emailConfirmed, setEmailConfirmed] = useState(() => readEmailConfirmation());
  const [onboardingRefresh, setOnboardingRefresh] = useState(0);
  const { signOut, user, isConfigured } = useAuth();
  const { loadWorkspace, profile, resumeUploads, jobs, jobScores, resumeVersions, interviewPrep, billing, loading, loadedFor } = useWorkspaceStore();
  const location = useLocation();
  const current = navItems.find((item) => location.pathname === item.path) ?? navItems.find((item) => location.pathname.startsWith(item.path));
  const onboardingState = buildOnboardingState({ profile, resumeUploads, jobs, jobScores, resumeVersions, interviewPrep, refreshKey: onboardingRefresh });

  useEffect(() => {
    loadWorkspace(user);
  }, [loadWorkspace, user]);

  useEffect(() => {
    if (hasManualSidebarPreference) return undefined;
    const narrowDesktop = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)");
    const syncSidebar = () => setCollapsed(narrowDesktop.matches);
    syncSidebar();
    narrowDesktop.addEventListener("change", syncSidebar);
    return () => narrowDesktop.removeEventListener("change", syncSidebar);
  }, [hasManualSidebarPreference]);

  useEffect(() => {
    if (location.hash) {
      window.setTimeout(() => {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.hash, location.pathname]);

  useEffect(() => {
    const refreshOnboarding = () => setOnboardingRefresh((value) => value + 1);
    window.addEventListener(onboardingUpdatedEvent, refreshOnboarding);
    return () => window.removeEventListener(onboardingUpdatedEvent, refreshOnboarding);
  }, []);

  useEffect(() => {
    function showHelp(event) {
      setHelpCenter({ open: true, section: event.detail?.section || "" });
      trackProductEvent("help_center_opened", { section: event.detail?.section || "" });
    }
    window.addEventListener(openHelpCenterEvent, showHelp);
    return () => window.removeEventListener(openHelpCenterEvent, showHelp);
  }, []);

  useEffect(() => {
    function showFeedback(event) {
      const type = event.detail?.type || "Feedback";
      setFeedbackModal({ open: true, type });
      trackProductEvent("feedback_opened", { type, source: "global_event" });
    }
    window.addEventListener(openFeedbackEvent, showFeedback);
    return () => window.removeEventListener(openFeedbackEvent, showFeedback);
  }, []);

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
    clearProductTourRestart();
    writeBooleanFlag(onboardingStorageKey, true);
    setOnboardingDismissed(true);
  }

  function acknowledgeEmailConfirmation() {
    clearEmailConfirmation();
    setEmailConfirmed(false);
  }

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(sidebarPreferenceKey, String(next));
      return next;
    });
    setHasManualSidebarPreference(true);
  }

  const workspaceReady = !loading && loadedFor === (user?.id ?? "local-demo-user");
  if (workspaceReady && shouldShowFullOnboarding(onboardingState, { pathname: location.pathname, dismissed: onboardingDismissed })) {
    const tourState = readProductTourRestart() ? getRestartedTourState(onboardingState) : onboardingState;
    return <OnboardingFlow state={tourState} emailConfirmed={emailConfirmed} onEmailConfirmationAcknowledged={acknowledgeEmailConfirmation} onDismiss={dismissOnboarding} />;
  }
  const showOnboardingRibbon = workspaceReady && !onboardingState.completed && shouldShowOnboardingRibbon(location.pathname);

  const sidebar = (
    <aside className={`${collapsed ? "w-20" : "w-72"} flex h-full flex-col border-r border-white/10 bg-[#07111F] text-[#F8FAFC] transition-all lg:sticky lg:top-0 lg:h-screen`}>
      <div className={`${collapsed ? "flex min-h-24 flex-col items-center justify-center gap-1 px-2" : "relative flex min-h-28 items-center px-4 py-4"}`}>
        <Link to="/app/dashboard" className={collapsed ? "flex justify-center" : "min-w-0 flex-1 pr-9"}>
          <Logo compact={collapsed} sidebar />
        </Link>
        <button
          type="button"
          className={`${collapsed ? "" : "absolute right-3 top-3"} rounded-lg p-2 text-[#94A3B8] hover:bg-white/10 hover:text-white`}
          onClick={toggleSidebar}
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
                isActive ? "bg-brand-500 text-white shadow-[0_12px_30px_rgba(255,122,0,0.22)]" : "text-[#CBD5E1] hover:bg-white/10 hover:text-white"
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/10 p-4">
        {!collapsed && (
          <div className="mb-3 rounded-lg border border-white/10 bg-white/10 p-3 text-sm">
            <div className="font-semibold text-white">{profile?.email || user?.email || "Local preview"}</div>
            <div className="text-[#94A3B8]">{isConfigured ? "Signed in" : "Supabase not configured"}</div>
          </div>
        )}
        <Button variant="ghost" className="w-full justify-start text-[#CBD5E1] hover:bg-white/10 hover:text-white" onClick={isConfigured ? signOut : undefined}>
          <LogOut size={18} />
          {!collapsed && "Logout"}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-ink">
      <div className="hidden min-h-screen lg:flex">
        {sidebar}
        <main className="min-w-0 flex-1">
          <Header title={current?.label ?? "Dashboard"} billing={billing} onMenu={() => setMobileOpen(true)} onCommand={() => setCommandOpen(true)} />
          <div className="mx-auto w-full min-w-0 max-w-7xl px-6 py-6">
            {showOnboardingRibbon && (
              <>
                <GettingStartedRibbon state={onboardingState} dismissed={trackerDismissed} />
                <CompletionRibbon state={onboardingState} dismissed={trackerDismissed} onDismiss={() => setTrackerDismissed(true)} />
              </>
            )}
            <Outlet />
            <AppLegalFooter />
          </div>
        </main>
      </div>

      <div className="lg:hidden">
        <Header title={current?.label ?? "Dashboard"} billing={billing} onMenu={() => setMobileOpen(true)} onCommand={() => setCommandOpen(true)} />
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-ink/30">
            <div className="h-full max-w-80 bg-[#07111F] shadow-soft">
              <div className="flex justify-end p-3">
                <button className="rounded-lg p-2 text-[#CBD5E1] hover:bg-white/10 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                  <X size={20} />
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}
        <main className="min-w-0 px-4 py-5">
          {showOnboardingRibbon && (
            <>
              <GettingStartedRibbon state={onboardingState} dismissed={trackerDismissed} />
              <CompletionRibbon state={onboardingState} dismissed={trackerDismissed} onDismiss={() => setTrackerDismissed(true)} />
            </>
          )}
          <Outlet />
          <AppLegalFooter />
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-500 px-4 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        onClick={() => {
          setHelpCenter({ open: true, section: "" });
          trackProductEvent("help_center_opened", { source: "floating_button" });
        }}
        aria-label="Open OccuBoard Help Center"
      >
        <HelpCircle size={17} aria-hidden="true" /> Help
      </button>
      <HelpCenter
        open={helpCenter.open}
        initialSection={helpCenter.section}
        onClose={() => setHelpCenter({ open: false, section: "" })}
        onOpenFeedback={(type) => {
          setFeedbackModal({ open: true, type });
          trackProductEvent("feedback_opened", { type, source: "help_center" });
        }}
        onRestart={() => {
          setHelpCenter({ open: false, section: "" });
          setOnboardingDismissed(false);
          setTrackerDismissed(false);
          setOnboardingRefresh((value) => value + 1);
          window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        }}
      />
      <FeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        userEmail={profile?.email || user?.email || ""}
        onClose={() => setFeedbackModal({ open: false, type: "Feedback" })}
      />
    </div>
  );
}

function AppLegalFooter() {
  return (
    <footer className="mt-8 border-t border-slate-200/70 pt-4 text-xs font-semibold text-slate-500">
      <nav className="flex flex-wrap justify-center gap-2" aria-label="Legal links">
        <Link className="hover:text-brand-800" to="/privacy">Privacy Policy</Link>
        <span aria-hidden="true">•</span>
        <Link className="hover:text-brand-800" to="/terms">Terms of Service</Link>
      </nav>
    </footer>
  );
}

function shouldShowOnboardingRibbon(pathname = "") {
  return [
    "/app/dashboard",
    "/app/resume-studio",
    "/app/new-jobs",
    "/app/applications",
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function Header({ title, billing, onMenu, onCommand }) {
  const pro = isProSubscription(billing?.subscription);
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#07111F]/95 px-4 text-[#F8FAFC] backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button type="button" className="rounded-lg p-2 text-[#CBD5E1] hover:bg-white/10 hover:text-white lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu size={21} />
        </button>
        <Link to="/app/dashboard" className="hidden shrink-0 sm:block" aria-label="OccuBoard dashboard">
          <Logo compact />
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Workspace</p>
          <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-black ring-1 sm:inline-flex ${pro ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-slate-50 text-slate-700 ring-slate-100"}`}>
          {pro ? "PRO" : "Free"}
        </span>
        <button
          type="button"
          className="hidden min-h-10 items-center gap-3 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-semibold text-[#CBD5E1] shadow-sm transition hover:border-brand-500/40 hover:bg-white/15 hover:text-white sm:inline-flex"
          onClick={onCommand}
          aria-label="Open search or command palette"
        >
          <Command size={16} className="text-brand-400" />
          <span>Search or command...</span>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold text-[#94A3B8]">Ctrl K</span>
        </button>
        <Link to="/app/new-jobs" className="hidden sm:block">
          <Button variant="secondary">Analyze a Job</Button>
        </Link>
      </div>
    </header>
  );
}
