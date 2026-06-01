import { AlertTriangle, CalendarCheck, CheckCircle2, ChevronRight, Clock3, FileText, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button.jsx";
import { CompanyLogo } from "../../components/ui/CompanyLogo.jsx";
import { getLatestFitScore } from "../../components/ui/FitScoreBadge.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useToast } from "../../contexts/ToastContext.jsx";
import { getActiveJobs, getArchivedJobs, isArchivedJob } from "../../lib/archive.js";
import { formatDate, todayIso } from "../../lib/date.js";
import { normalizeStage } from "../../lib/followUp.js";
import { getDisplayCompanyName, getDisplayJobTitle } from "../../lib/jobDisplay.js";
import { getJobAiStatus, isCoverLetter } from "../../lib/jobAiStatus.js";
import { useWorkspaceStore } from "../../stores/workspaceStore.js";
import { getNextBestAction } from "../../utils/nextBestAction.js";
import { JobDetail } from "./JobsPage.jsx";

const FOLLOW_UP_RULES = {
  followUpSoonDays: 1,
  noResponseDays: 14,
  interviewFollowUpDays: 1,
  healthyActivityDays: 7,
  waitingWindowDays: 14,
};

export function ApplicationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { jobs, jobScores, resumeVersions, messages, jobContacts, jobActivityLogs, interviewPrep, loading, error, updateJob, deleteJob } = useWorkspaceStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { applicationId } = useParams();
  const [searchParams] = useSearchParams();
  const [smartFilter, setSmartFilter] = useState("All");
  const [archiveMode, setArchiveMode] = useState("active");
  const [viewMode, setViewMode] = useState("board");
  const [success, setSuccess] = useState("");
  const activeJobs = useMemo(() => getActiveJobs(jobs), [jobs]);
  const archivedJobs = useMemo(() => getArchivedJobs(jobs), [jobs]);
  const baseVisibleJobs = archiveMode === "archived" || smartFilter === "Archived" ? archivedJobs : activeJobs;
  const metrics = useMemo(() => getApplicationMetrics(activeJobs, { jobScores, jobContacts, resumeVersions, messages, jobActivityLogs }), [activeJobs, jobActivityLogs, jobContacts, jobScores, messages, resumeVersions]);
  const enrichedJobs = useMemo(
    () => baseVisibleJobs.map((job) => getApplicationCardModel(job, { jobScores, resumeVersions, messages, jobContacts, jobActivityLogs, interviewPrep })),
    [baseVisibleJobs, jobActivityLogs, jobContacts, jobScores, interviewPrep, messages, resumeVersions],
  );
  const visibleJobs = useMemo(() => enrichedJobs.filter((model) => matchesSmartFilter(model, smartFilter)), [enrichedJobs, smartFilter]);
  const actionQueue = useMemo(() => getActionQueue(enrichedJobs.filter((model) => !model.archived)), [enrichedJobs]);
  const focusJobs = useMemo(() => getFocusViewJobs(actionQueue), [actionQueue]);
  const displayedJobs = viewMode === "focus" ? focusJobs : visibleJobs;

  useEffect(() => {
    const openJobId = location.state?.openJobId || searchParams.get("jobId");
    if (!openJobId || !jobs.length) return;
    const job = jobs.find((item) => item.id === openJobId);
    if (job) {
      navigate(`/app/applications/${openJobId}`, {
        replace: true,
        state: {
          openJobTab: location.state?.openJobTab || location.state?.initialTab || searchParams.get("tab") || "overview",
          focus: location.state?.focus || searchParams.get("focus") || "",
          contactId: location.state?.contactId || searchParams.get("contactId") || "",
        },
      });
      return;
    } else {
      setSuccess("That opportunity could not be found.");
      window.setTimeout(() => setSuccess(""), 2600);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [jobs, location.pathname, location.state, navigate, searchParams]);

  if (applicationId) {
    return (
      <ApplicationWorkspacePage
        applicationId={applicationId}
        initialTab={location.state?.openJobTab || location.state?.initialTab || searchParams.get("tab") || "overview"}
        initialFocus={location.state?.focus || searchParams.get("focus") || ""}
        initialContactId={location.state?.contactId || searchParams.get("contactId") || ""}
        onBack={() => navigate("/app/applications")}
      />
    );
  }

  async function restoreJob(job) {
    const restored = await updateJob(user, job.id, { archived_at: null, archived_reason: "", archived_by_user: false });
    setArchiveMode("active");
    setSmartFilter("All");
    setSuccess("Opportunity restored.");
    toast.success("Opportunity restored.");
    window.setTimeout(() => setSuccess(""), 2600);
    return restored;
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Application Command Center</h2>
          <p className="mt-1 text-sm text-slate-600">Today&apos;s priorities, ready-to-apply roles, and active opportunities in one calm workspace.</p>
        </div>
        <Link to="/app/new-jobs" className="w-fit">
          <Button>Analyze New Job</Button>
        </Link>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 shadow-sm">
          <CheckCircle2 size={18} /> {success}
        </div>
      )}

      {error && <div className="mb-5 rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>}

      {archiveMode === "active" && <ActionQueueSection queue={actionQueue} onOpen={(jobId) => navigate(`/app/applications/${jobId}`)} />}

      <CareerMomentumPanel metrics={metrics} />

      <SmartFilterPills
        active={smartFilter}
        archivedCount={archivedJobs.length}
        onChange={(filter) => {
          setSmartFilter(filter);
          setArchiveMode(filter === "Archived" ? "archived" : "active");
          if (filter === "Archived") setViewMode("board");
        }}
      />

      <ViewModeToggle mode={viewMode} onChange={setViewMode} disabled={archiveMode === "archived"} />

      {loading ? (
        <ApplicationCardsSkeleton />
      ) : !displayedJobs.length ? (
        <EmptyApplicationState filter={smartFilter} archiveMode={archiveMode} viewMode={viewMode}>
          {archiveMode === "active" && smartFilter === "All" && (
            <Link to="/app/new-jobs" className="mt-5 inline-flex">
              <Button>Analyze New Job</Button>
            </Link>
          )}
        </EmptyApplicationState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayedJobs.map((model) => (
            <ApplicationCard key={model.job.id} model={model} onOpen={() => navigate(`/app/applications/${model.job.id}`)} onRestore={model.archived ? () => restoreJob(model.job) : undefined} onDelete={model.archived ? () => deleteJob(user, model.job.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

function CareerMomentumPanel({ metrics }) {
  return (
    <section className="mb-5 rounded-2xl bg-white/90 p-4 shadow-card ring-1 ring-brand-100">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">Career Momentum</p>
          <h3 className="mt-1 text-xl font-bold text-ink">Your search is moving.</h3>
        </div>
        <p className="text-sm font-semibold text-slate-600">Keep the next useful action visible.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Search streak" value={`${metrics.currentStreak} day${metrics.currentStreak === 1 ? "" : "s"}`} helper="Recent daily search activity." />
        <MetricCard label="Interviews this month" value={metrics.interviewsThisMonth} helper="Interview momentum this month." />
        <MetricCard label="Ready to apply" value={metrics.readyToApply} helper="Prepared roles waiting on submission." />
        <MetricCard label="Top opportunity" value={metrics.topOpportunity.title} helper={metrics.topOpportunity.helper} />
        <MetricCard label="Best next move" value={metrics.bestNextMove.title} helper={metrics.bestNextMove.helper} />
      </div>
    </section>
  );
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-brand-100">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function ActionQueueSection({ queue, onOpen }) {
  const sections = [
    {
      title: "Apply Today",
      items: queue.applyToday,
      helper: "Prepared roles ready for submission.",
      action: "Open ready role",
      icon: CheckCircle2,
      cardClass: "from-emerald-50 via-white to-cyan-50 ring-emerald-100",
      badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200",
      buttonClass: "bg-emerald-700 text-white hover:bg-emerald-800",
    },
    {
      title: "Needs Attention",
      items: queue.needsAttention,
      helper: "Missing materials or stale opportunities.",
      action: "Review next step",
      icon: AlertTriangle,
      cardClass: "from-amber-50 via-white to-orange-50 ring-amber-100",
      badgeClass: "bg-amber-100 text-amber-800 ring-amber-200",
      buttonClass: "bg-amber-600 text-white hover:bg-amber-700",
    },
    {
      title: "Follow Up",
      items: queue.followUp,
      helper: "Touchpoints that keep momentum alive.",
      action: "Open follow-up",
      icon: Clock3,
      cardClass: "from-brand-50 via-white to-cyan-50 ring-brand-100",
      badgeClass: "bg-brand-100 text-brand-800 ring-brand-200",
      buttonClass: "bg-brand-700 text-white hover:bg-brand-800",
    },
  ];
  return (
    <section className="mb-5 grid gap-3 xl:grid-cols-3">
      {sections.map(({ title, items, helper, action, icon: Icon, cardClass, badgeClass, buttonClass }) => (
        <div key={title} className={`rounded-xl bg-gradient-to-br p-4 shadow-sm ring-1 ${cardClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${badgeClass}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">{title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">{helper}</p>
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-black ring-1 ${badgeClass}`}>{items.length}</span>
          </div>
          <div className="mt-3 grid gap-2">
            {items.slice(0, 2).map((model) => (
              <button key={model.job.id} type="button" onClick={() => onOpen(model.job.id)} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-left ring-1 ring-white/80 transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{getDisplayJobTitle(model.job)}</span>
                  <span className="block truncate text-xs font-semibold text-slate-600">{getDisplayCompanyName(model.job)} / {model.action.label}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-slate-400" />
              </button>
            ))}
            {items.length > 0 ? (
              <button type="button" onClick={() => onOpen(items[0].job.id)} className={`mt-1 inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${buttonClass}`}>
                {action}
              </button>
            ) : (
              <p className="rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600">You&apos;re caught up here.</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function ViewModeToggle({ mode, onChange, disabled }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-600">{mode === "focus" ? "Focus View: Only what needs action." : "Board View: All opportunities."}</p>
      <div className="inline-flex w-fit rounded-full bg-white p-1 shadow-sm ring-1 ring-brand-100">
        {["board", "focus"].map((item) => {
          const active = mode === item;
          const label = item === "board" ? "Board View" : "Focus View";
          return (
            <button
              key={item}
              type="button"
              disabled={disabled && item === "focus"}
              onClick={() => onChange(item)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-brand-50"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SmartFilterPills({ active, archivedCount, onChange }) {
  const filters = ["All", "Ready To Apply", "Needs Resume", "Needs Cover Letter", "Needs Follow Up", "Interviewing", "Applied", "Archived"];
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${active === filter ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-700 ring-brand-100 hover:bg-brand-50"}`}
        >
          {filter}{filter === "Archived" && archivedCount ? ` (${archivedCount})` : ""}
        </button>
      ))}
    </div>
  );
}

function EmptyApplicationState({ filter, archiveMode, viewMode, children }) {
  const archived = archiveMode === "archived" || filter === "Archived";
  const emptyCopy = getEmptyStateCopy({ filter, archived, viewMode });
  return (
    <div className="rounded-xl bg-white/90 p-8 text-center shadow-card ring-1 ring-brand-100">
      <h3 className="text-xl font-bold text-ink">{emptyCopy.title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{emptyCopy.copy}</p>
      {children}
    </div>
  );
}

function getEmptyStateCopy({ filter, archived, viewMode }) {
  if (viewMode === "focus") {
    return {
      title: "You are caught up.",
      copy: "No high-priority applications need action right now. Board View still has the full pipeline when you want it.",
    };
  }
  if (archived) {
    return {
      title: "No archived opportunities.",
      copy: "Archived roles will stay recoverable here when you need them.",
    };
  }
  const copyByFilter = {
    All: ["Start your command center.", "Analyze your first role and OccuBoard will organize the next steps here."],
    "Ready To Apply": ["Nothing waiting to apply.", "Generate materials for strong matches and ready roles will appear here."],
    "Needs Resume": ["Every visible role has a resume plan.", "You are current on resume prep for this filter."],
    "Needs Cover Letter": ["No cover letters needed right now.", "When a role would benefit from one, it will show up here."],
    "Needs Follow Up": ["You are caught up on follow-ups.", "No touchpoints need attention at the moment."],
    Interviewing: ["No active interviews yet.", "Interview-stage roles will appear here with prep shortcuts."],
    Applied: ["No applied roles in this view.", "Once you mark roles applied, they will collect here."],
  };
  const [title, copy] = copyByFilter[filter] || [`No roles match ${filter}.`, "Try another filter or keep preparing your strongest roles."];
  return { title, copy };
}

function ApplicationWorkspacePage({ applicationId, initialTab = "overview", initialFocus = "", initialContactId = "", onBack }) {
  const { user } = useAuth();
  const { jobs, updateJob, deleteJob } = useWorkspaceStore();
  const job = jobs.find((item) => item.id === applicationId);

  if (!job) {
    return (
      <section className="rounded-xl bg-white/90 p-6 text-center shadow-card ring-1 ring-brand-100">
        <h2 className="text-xl font-bold text-ink">Application not found</h2>
        <p className="mt-2 text-sm text-slate-600">This opportunity may have been deleted or archived.</p>
        <Button className="mt-4" onClick={onBack}>Back to Applications</Button>
      </section>
    );
  }

  return (
    <JobDetail
      job={job}
      initialTab={initialFocus === "contacts" ? "contacts" : initialTab}
      initialFocus={initialFocus}
      initialContactId={initialContactId}
      pageMode
      onClose={onBack}
      onEdit={undefined}
      onDelete={async () => {
        await deleteJob(user, job.id);
        onBack();
      }}
      onArchive={onBack}
      onMove={async () => {
        await updateJob(user, job.id, { status: "Applied", applied_date: job.applied_date || todayIso() });
      }}
      onJobUpdate={() => {}}
    />
  );
}

function getPipelineStage(status) {
  const normalized = normalizeStage(status);
  if (normalized === "Closed") return "Rejected";
  if (normalized === "Offer") return "Offer";
  if (normalized === "Final Interview") return "Final Interview";
  if (normalized === "Recruiter Screen") return "Recruiter Screen";
  if (normalized === "Interview") return "Interview";
  if (normalized === "Applied") return "Applied";
  return "Saved";
}

function ApplicationCard({ model, onOpen, onRestore, onDelete }) {
  const { job, score, contacts, archived, stage, health, lastContact, interviewPrepScore, action, category } = model;
  const categoryTone = getApplicationCategoryTone(category);
  const scoreModel = getOpportunityScoreModel(score);
  const signal = getOpportunitySignal(model);
  const actionModel = getPrimaryActionModel(action, category, stage);
  const sizing = getOpportunityCardSizing({ category, stage });
  const showSignal = signal && signal.toLowerCase() !== category.toLowerCase();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      aria-label={`Open ${getDisplayJobTitle(job)} at ${getDisplayCompanyName(job)}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group cursor-pointer rounded-xl border-l-4 bg-white/95 text-left shadow-sm ring-1 ring-white/70 transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:ring-brand-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${categoryTone} ${sizing}`}
    >
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <div className="flex items-start gap-2.5">
            <CompanyLogo companyName={getDisplayCompanyName(job)} companyDomain={job.company_domain} companyLogoUrl={job.company_logo_url} sourceUrl={job.source_url} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2.5">
                <OpportunityScoreBadge model={scoreModel} />
                <p className="min-w-0 flex-1 overflow-hidden text-base font-bold leading-snug text-ink" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{getDisplayJobTitle(job)}</p>
              </div>
              <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{getDisplayCompanyName(job)} <span className="text-slate-300">/</span> {stage}</p>
              <p className={`mt-1 text-xs font-black uppercase tracking-[0.1em] ${scoreModel.textClass}`}>{scoreModel.label}</p>
            </div>
            <ChevronRight className="mt-1 shrink-0 text-slate-300 opacity-0 transition duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100" size={15} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusPill tone={getCategoryPillTone(category)}>{category}</StatusPill>
        {showSignal && <StatusPill tone={getSignalTone(signal)}>{signal}</StatusPill>}
      </div>
      {!archived && actionModel && (
        <div className={`mt-3 rounded-xl px-3 py-3 ring-1 ${actionModel.cardClass}`}>
          <div className="flex gap-2.5">
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${actionModel.iconClass}`}>
              <actionModel.Icon size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Primary action</span>
              <span className={`mt-0.5 block text-base font-black leading-tight ${actionModel.textClass}`}>{actionModel.label}</span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{actionModel.subtext}</span>
            </span>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500">
        {job.applied_date && <p>Applied {formatShortDate(job.applied_date)}</p>}
        {lastContact && <p>Last contact {formatShortDate(lastContact)}</p>}
        {contacts.length > 0 && <p>{contacts.length} contact{contacts.length === 1 ? "" : "s"}</p>}
        {health.label && <p>{health.label}</p>}
      </div>
      {["Interview", "Final Interview"].includes(stage) && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
          {"\u2713"} Interview Prep Available{interviewPrepScore ? `: ${interviewPrepScore}%` : ""}
        </div>
      )}
      {archived && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {onRestore && <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onRestore(); }}>Restore</Button>}
          {onDelete && <Button variant="danger" className="min-h-8 px-3 text-xs" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Delete</Button>}
        </div>
      )}
    </div>
  );
}

function OpportunityScoreBadge({ model }) {
  return (
    <span className={`inline-flex min-w-14 shrink-0 flex-col items-center justify-center rounded-xl px-2.5 py-1.5 text-center font-black ring-1 ${model.className}`}>
      <span className="text-lg leading-none">{model.value}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-[0.08em]">Fit</span>
    </span>
  );
}

function getOpportunityScoreModel(score) {
  const value = Number(score?.score);
  if (!Number.isFinite(value)) {
    return {
      value: "--",
      label: "Possible Match",
      className: "bg-slate-50 text-slate-600 ring-slate-100",
      textClass: "text-slate-500",
    };
  }
  const rounded = `${Math.round(value)}%`;
  if (value >= 90) return { value: rounded, label: "Excellent Match", className: "bg-emerald-50 text-emerald-800 ring-emerald-100", textClass: "text-emerald-700" };
  if (value >= 85) return { value: rounded, label: "Strong Match", className: "bg-emerald-50 text-emerald-800 ring-emerald-100", textClass: "text-emerald-700" };
  if (value >= 70) return { value: rounded, label: "Possible Match", className: "bg-amber-50 text-amber-800 ring-amber-100", textClass: "text-amber-700" };
  return { value: rounded, label: "Long Shot", className: "bg-rose-50 text-rose-700 ring-rose-100", textClass: "text-rose-700" };
}

function getPrimaryActionModel(action, category, stage) {
  if (!action || action.actionType === "no_action" || ["Archived", "Not Active"].includes(category) || stage === "Rejected") return null;
  const label = getPrimaryActionLabel(action.label, category, stage);
  const lower = label.toLowerCase();
  const tone = action.tone || (category === "Ready To Apply" ? "success" : "info");
  const Icon = lower.includes("interview") ? CalendarCheck : lower.includes("follow") || lower.includes("message") ? Send : FileText;
  const styles = {
    danger: ["bg-rose-50 ring-rose-100", "bg-rose-100 text-rose-700", "text-rose-800"],
    warning: ["bg-amber-50 ring-amber-100", "bg-amber-100 text-amber-800", "text-amber-800"],
    success: ["bg-emerald-50 ring-emerald-100", "bg-emerald-100 text-emerald-800", "text-emerald-800"],
    info: ["bg-brand-50 ring-brand-100", "bg-brand-100 text-brand-800", "text-brand-800"],
    neutral: ["bg-slate-50 ring-slate-100", "bg-slate-100 text-slate-700", "text-slate-700"],
  }[tone] ?? ["bg-brand-50 ring-brand-100", "bg-brand-100 text-brand-800", "text-brand-800"];
  return {
    Icon,
    label,
    subtext: getPrimaryActionSubtext(label, category, stage),
    cardClass: styles[0],
    iconClass: styles[1],
    textClass: styles[2],
  };
}

function getPrimaryActionLabel(label, category, stage) {
  const lower = String(label || "").toLowerCase();
  if (category === "Ready To Apply") return "Submit Application";
  if (["Interview", "Final Interview", "Recruiter Screen"].includes(stage) && lower.includes("interview")) return "Prepare For Interview";
  if (lower.includes("follow")) return "Send Follow Up";
  if (lower.includes("cover")) return "Generate Cover Letter";
  if (lower.includes("resume")) return "Generate Resume";
  if (lower.includes("message")) return "Draft Recruiter Message";
  return label || "Open Opportunity";
}

function getPrimaryActionSubtext(label, category, stage) {
  const lower = String(label || "").toLowerCase();
  if (category === "Ready To Apply") return "Materials are ready. Open the command center to export or mark applied.";
  if (lower.includes("interview") || ["Interview", "Final Interview", "Recruiter Screen"].includes(stage)) return "Review prep, stories, and likely questions before the next conversation.";
  if (lower.includes("follow")) return "Keep the opportunity warm with a clear next touchpoint.";
  if (lower.includes("cover")) return "Add the optional letter when it strengthens the application package.";
  if (lower.includes("resume")) return "Tailor the resume before building the rest of the package.";
  if (lower.includes("message")) return "Prepare concise outreach after the core materials are ready.";
  return "Open the opportunity workspace for the next useful step.";
}

function getOpportunitySignal(model) {
  if (model.archived) return "Archived insight";
  if (model.stage === "Rejected") return "Not active";
  if (["Interview", "Final Interview", "Recruiter Screen"].includes(model.stage)) return model.interviewPrepScore ? "Interview Ready" : "Interviewing";
  if (model.reminder || model.health.tone === "danger") return "Follow Up Recommended";
  if (model.category === "Ready To Apply") return "Ready To Apply";
  if (model.status.resumeDrafted && !model.hasCoverLetter) return "Missing Cover Letter";
  if (model.status.resumeDrafted) return "Resume Complete";
  if (isAppliedPipelineStage(model.stage)) return "Waiting On Employer";
  return "Needs Resume";
}

function getSignalTone(signal) {
  if (["Interview Ready", "Ready To Apply", "Resume Complete"].includes(signal)) return "healthy";
  if (["Interviewing", "Waiting On Employer"].includes(signal)) return "info";
  if (["Missing Cover Letter", "Follow Up Recommended", "Needs Resume"].includes(signal)) return "warning";
  return "neutral";
}

function getOpportunityCardSizing({ category, stage }) {
  if (category === "Archived") return "px-3 py-2.5 opacity-90";
  if (stage === "Rejected" || category === "Not Active") return "px-3 py-2.5";
  if (category === "Ready To Apply" || ["Interview", "Final Interview", "Recruiter Screen"].includes(stage)) return "px-3.5 py-4";
  return "px-3 py-3";
}

function StatusPill({ tone = "neutral", children }) {
  const styles = {
    healthy: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    info: "bg-brand-50 text-brand-800 ring-brand-100",
    waiting: "bg-amber-50 text-amber-800 ring-amber-100",
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    warning: "bg-amber-50 text-amber-800 ring-amber-100",
    neutral: "bg-slate-50 text-slate-600 ring-slate-100",
  }[tone] ?? "bg-slate-50 text-slate-600 ring-slate-100";
  return <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${styles}`}>{children}</span>;
}

function getApplicationCardModel(job, { jobScores = [], resumeVersions = [], messages = [], jobContacts = [], jobActivityLogs = [], interviewPrep = [] }) {
  const score = getLatestFitScore(jobScores, job.id);
  const status = getJobAiStatus(job.id, jobScores, resumeVersions, messages);
  const contacts = jobContacts.filter((contact) => contact.job_id === job.id);
  const timeline = getApplicationTimeline(job, { jobActivityLogs, messages, resumeVersions });
  const prep = interviewPrep.find((item) => item.job_id === job.id);
  const stage = getPipelineStage(job.status);
  const archived = isArchivedJob(job);
  const health = getApplicationHealth(job, timeline);
  const reminder = getApplicationReminder(job, contacts, timeline);
  const action = getNextBestAction(job, { score, aiStatus: status, messages });
  const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
  const interviewPrepScore = prep?.content ? getApplicationInterviewPrepScore(prep) : null;
  return {
    job,
    score,
    status,
    contacts,
    timeline,
    prep,
    stage,
    archived,
    health,
    reminder,
    action,
    hasCoverLetter,
    interviewPrepScore,
    lastContact: getLastContactDate(contacts),
    category: getApplicationCategory({ archived, stage, status, hasCoverLetter, health }),
  };
}

function getApplicationCategory({ archived, stage, status, hasCoverLetter, health }) {
  if (archived) return "Archived";
  if (stage === "Rejected") return "Not Active";
  if (["Interview", "Final Interview", "Recruiter Screen"].includes(stage)) return "Interviewing";
  if (status.resumeDrafted && status.messageDrafted && hasCoverLetter && stage === "Saved") return "Ready To Apply";
  if (health.tone === "danger" || !status.resumeDrafted || !hasCoverLetter) return "Needs Attention";
  return "Active";
}

function getApplicationCategoryTone(category) {
  return {
    "Ready To Apply": "border-l-emerald-400 bg-emerald-50/30 ring-emerald-100",
    "Needs Attention": "border-l-amber-300 bg-amber-50/20 ring-amber-100",
    Interviewing: "border-l-brand-500 bg-brand-50/35 ring-brand-100",
    Archived: "border-l-slate-300 opacity-90",
    "Not Active": "border-l-slate-300 bg-slate-50/70 opacity-90",
    Active: "border-l-slate-200",
  }[category] ?? "border-l-slate-200";
}

function getCategoryPillTone(category) {
  return {
    "Ready To Apply": "healthy",
    "Needs Attention": "warning",
    Interviewing: "info",
    Archived: "neutral",
    "Not Active": "neutral",
  }[category] ?? "neutral";
}

function matchesSmartFilter(model, filter) {
  if (filter === "All") return !model.archived;
  if (filter === "Archived") return model.archived;
  if (filter === "Ready To Apply") return model.category === "Ready To Apply";
  if (filter === "Needs Resume") return !model.status.resumeDrafted && !model.archived;
  if (filter === "Needs Cover Letter") return !model.hasCoverLetter && !model.archived;
  if (filter === "Needs Follow Up") return model.health.tone === "danger" || Boolean(model.reminder);
  if (filter === "Interviewing") return model.category === "Interviewing";
  if (filter === "Applied") return model.stage === "Applied";
  return true;
}

function getActionQueue(models) {
  return {
    applyToday: models.filter((model) => model.category === "Ready To Apply").slice(0, 5),
    needsAttention: models.filter((model) => model.category === "Needs Attention").slice(0, 5),
    followUp: models.filter((model) => model.health.tone === "danger" || model.reminder).slice(0, 5),
  };
}

function getFocusViewJobs(queue) {
  const seen = new Set();
  return [queue.applyToday, queue.followUp, queue.needsAttention]
    .flat()
    .filter((model) => {
      if (seen.has(model.job.id)) return false;
      seen.add(model.job.id);
      return true;
    })
    .slice(0, 12);
}

function getApplicationMetrics(activeJobs, { jobScores = [], jobContacts = [], resumeVersions = [], messages = [], jobActivityLogs = [] }) {
  const activeApplications = activeJobs.filter((job) => getPipelineStage(job.status) !== "Saved").length;
  const interviewsScheduled = activeJobs.filter((job) => ["Interview", "Final Interview"].includes(getPipelineStage(job.status)) || job.interview_date).length;
  const interviewsThisMonth = activeJobs.filter((job) => (["Interview", "Final Interview"].includes(getPipelineStage(job.status)) && isThisMonth(job.updated_at || job.created_at)) || isThisMonth(job.interview_date)).length;
  const appliedOrBeyond = activeJobs.filter((job) => isAppliedPipelineStage(getPipelineStage(job.status)));
  const responded = appliedOrBeyond.filter((job) => jobContacts.some((contact) => contact.job_id === job.id && contact.last_contacted_at) || ["Recruiter Screen", "Interview", "Final Interview", "Offer"].includes(getPipelineStage(job.status))).length;
  const scored = activeJobs.map((job) => getLatestFitScore(jobScores, job.id)?.score).filter((value) => Number.isFinite(Number(value)));
  const topJob = getTopOpportunity(activeJobs, jobScores);
  const followUpsNeeded = activeJobs.filter((job) => getApplicationHealth(job, getApplicationTimeline(job, {})).tone === "danger").length;
  const readyToApply = activeJobs.filter((job) => {
    const status = getJobAiStatus(job.id, jobScores, resumeVersions, messages);
    const hasCoverLetter = messages.some((message) => message.job_id === job.id && isCoverLetter(message));
    return getPipelineStage(job.status) === "Saved" && status.resumeDrafted && status.messageDrafted && hasCoverLetter;
  }).length;
  const bestMove = getBestNextMove({ readyToApply, interviewsThisMonth, followUpsNeeded, activeApplications });
  return {
    activeApplications,
    interviewsScheduled,
    interviewsThisMonth,
    readyToApply,
    currentStreak: getCurrentActivityStreak(activeJobs, { jobActivityLogs, messages, resumeVersions }),
    topOpportunity: topJob,
    bestNextMove: bestMove,
    responseRate: appliedOrBeyond.length ? Math.round((responded / appliedOrBeyond.length) * 100) : 0,
    averageFitScore: scored.length ? Math.round(scored.reduce((sum, value) => sum + Number(value), 0) / scored.length) : 0,
    followUpsNeeded,
    applicationsThisMonth: activeJobs.filter((job) => isThisMonth(job.applied_date)).length,
  };
}

function isAppliedPipelineStage(stage) {
  return ["Applied", "Recruiter Screen", "Interview", "Final Interview", "Offer", "Rejected"].includes(stage);
}

function getTopOpportunity(activeJobs, jobScores) {
  const top = activeJobs
    .filter((job) => getPipelineStage(job.status) !== "Rejected")
    .map((job) => ({ job, score: Number(getLatestFitScore(jobScores, job.id)?.score) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score)[0];
  if (!top) return { title: "Not scored yet", helper: "Analyze roles to reveal the strongest match." };
  return {
    title: `${Math.round(top.score)}%`,
    helper: `${getDisplayJobTitle(top.job)} at ${getDisplayCompanyName(top.job)}`,
  };
}

function getBestNextMove({ readyToApply, interviewsThisMonth, followUpsNeeded, activeApplications }) {
  if (readyToApply > 0) return { title: "Submit ready role", helper: `${readyToApply} package${readyToApply === 1 ? " is" : "s are"} ready.` };
  if (followUpsNeeded > 0) return { title: "Follow up", helper: `${followUpsNeeded} touchpoint${followUpsNeeded === 1 ? "" : "s"} need attention.` };
  if (interviewsThisMonth > 0) return { title: "Practice interview", helper: "Keep prep fresh for active interview momentum." };
  if (activeApplications > 0) return { title: "Advance one role", helper: "Pick the strongest opportunity and complete the next asset." };
  return { title: "Analyze a role", helper: "Start with a job analysis to build momentum." };
}

function getApplicationTimeline(job, { jobActivityLogs = [], messages = [], resumeVersions = [] }) {
  const events = [
    job.created_at && { type: "saved", label: "Saved", created_at: job.created_at },
    job.applied_date && { type: "applied", label: "Applied", created_at: job.applied_date },
    job.interview_date && { type: "interview_scheduled", label: "Interview Scheduled", created_at: job.interview_date },
    ...resumeVersions.filter((item) => item.job_id === job.id).map((item) => ({ type: "resume_generated", label: "Resume Generated", created_at: item.created_at })),
    ...messages.filter((item) => item.job_id === job.id).map((item) => ({ type: "message_generated", label: `${item.type || "Message"} Generated`, created_at: item.created_at })),
    ...jobActivityLogs.filter((item) => item.job_id === job.id).map((item) => ({ type: item.type, label: item.metadata?.detail || item.type || "Activity", created_at: item.created_at })),
  ].filter(Boolean);
  return events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getApplicationHealth(job, timeline) {
  const days = daysSince(getLatestActivityDate(job, timeline));
  if (days <= FOLLOW_UP_RULES.healthyActivityDays) return { label: "Healthy", tone: "healthy" };
  if (days <= FOLLOW_UP_RULES.waitingWindowDays) return { label: "Waiting", tone: "waiting" };
  return { label: "Needs Follow-Up", tone: "danger" };
}

function getApplicationReminder(job, contacts, timeline) {
  const stage = getPipelineStage(job.status);
  const followUpDate = job.followup_date || job.followUpDate;
  const daysToFollowUp = followUpDate ? daysUntil(followUpDate) : null;
  if (daysToFollowUp === FOLLOW_UP_RULES.followUpSoonDays) return "Follow Up Tomorrow";
  if (["Interview", "Final Interview"].includes(stage) && daysSince(job.interview_date) >= FOLLOW_UP_RULES.interviewFollowUpDays) return "Interview Follow-Up Recommended";
  const lastContact = getLastContactDate(contacts);
  const reference = lastContact || job.applied_date || getLatestActivityDate(job, timeline);
  if (isAppliedPipelineStage(stage) && daysSince(reference) >= FOLLOW_UP_RULES.noResponseDays) return `No Response For ${FOLLOW_UP_RULES.noResponseDays} Days`;
  return "";
}

function getLatestActivityDate(job, timeline) {
  return timeline[0]?.created_at || job.updated_at || job.created_at || job.date_saved;
}

function getLastContactDate(contacts = []) {
  return contacts.map((contact) => contact.last_contacted_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || "";
}

function getApplicationInterviewPrepScore(prep) {
  const content = prep?.content || {};
  const questions = Array.isArray(content.questions) ? content.questions.length : 0;
  const stories = Array.isArray(content.starStories) ? content.starStories.length : 0;
  return Math.min(100, 45 + questions * 5 + stories * 10);
}

function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function formatShortDate(value) {
  return formatDate(String(value).slice(0, 10));
}

function isThisMonth(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getCurrentActivityStreak(activeJobs, { jobActivityLogs = [], messages = [], resumeVersions = [] }) {
  const activeIds = new Set(activeJobs.map((job) => job.id));
  const activityDates = new Set();
  activeJobs.forEach((job) => {
    [job.created_at, job.updated_at, job.applied_date, job.interview_date].filter(Boolean).forEach((value) => activityDates.add(toDateKey(value)));
  });
  [...jobActivityLogs, ...messages, ...resumeVersions].forEach((item) => {
    if (activeIds.has(item.job_id) && item.created_at) activityDates.add(toDateKey(item.created_at));
  });

  let streak = 0;
  const cursor = new Date();
  while (activityDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function ApplicationCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="rounded-xl border-l-4 border-l-slate-200 bg-white/90 px-3 py-3 shadow-sm ring-1 ring-white/70">
          <div className="flex items-start gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-3/4 rounded-full bg-slate-100" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100" />
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-20 rounded-full bg-slate-100" />
                <div className="h-5 w-16 rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <div className="h-3 w-full rounded-full bg-slate-100" />
            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function getNextAction(job, status) {
  return getNextBestAction(job, { aiStatus: status }).label;
}




